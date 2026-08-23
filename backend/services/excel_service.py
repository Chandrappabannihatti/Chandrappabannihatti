"""
Excel / CSV upload service.

Supported upload types and required columns (case-insensitive):

  attendance : USN, SubjectCode, Semester, ClassesHeld, ClassesAttended
  ia         : USN, SubjectCode, Semester, IA1, IA2
  assignment : USN, SubjectCode, Semester, AssignmentMarks

Pipeline: parse -> schema validation -> row validation -> preview
(mode=preview) or upsert into MySQL/SQLite (mode=import).
"""
import io

import pandas as pd

from extensions import db
from models import Assignment, Attendance, IAMarks, Student, Subject

UPLOAD_SPECS = {
    "attendance": {
        "columns": ["usn", "subjectcode", "semester", "classesheld", "classesattended"],
        "label": "Attendance",
    },
    "ia": {
        "columns": ["usn", "subjectcode", "semester", "ia1", "ia2"],
        "label": "IA Marks",
    },
    "assignment": {
        "columns": ["usn", "subjectcode", "semester", "assignmentmarks"],
        "label": "Assignment Marks",
    },
}


class UploadError(Exception):
    pass


def _read_file(file_storage) -> pd.DataFrame:
    filename = (file_storage.filename or "").lower()
    data = file_storage.read()
    if not data:
        raise UploadError("Uploaded file is empty")
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(data))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(data), engine="openpyxl")
        else:
            raise UploadError("Unsupported file type. Use .xlsx, .xls or .csv")
    except UploadError:
        raise
    except Exception as exc:
        raise UploadError(f"Could not parse file: {exc}")
    df.columns = [str(c).strip().lower().replace(" ", "") for c in df.columns]
    return df


def _num(value, default=None):
    try:
        if pd.isna(value):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_and_validate(upload_type: str, file_storage, teacher_subject_ids=None):
    """Returns (rows, errors). rows carry _status/_error per row."""
    spec = UPLOAD_SPECS.get(upload_type)
    if spec is None:
        raise UploadError(f"Unknown upload type '{upload_type}'")

    df = _read_file(file_storage)
    missing = [c for c in spec["columns"] if c not in df.columns]
    if missing:
        raise UploadError(f"Missing required columns: {', '.join(missing)}")

    df = df.dropna(how="all").head(2000)  # safety cap

    usn_map = {s.usn.upper(): s for s in Student.query.all()}
    code_map = {s.code.upper(): s for s in Subject.query.all()}

    rows, err_count = [], 0
    for i, rec in df.iterrows():
        row_num = i + 2  # header = row 1
        entry = {"row": row_num}
        errors = []

        usn = str(rec.get("usn", "")).strip().upper()
        code = str(rec.get("subjectcode", "")).strip().upper()
        semester = _num(rec.get("semester"))

        student = usn_map.get(usn)
        subject = code_map.get(code)
        if not usn or student is None:
            errors.append(f"Unknown USN '{usn or '(blank)'}'")
        if not code or subject is None:
            errors.append(f"Unknown SubjectCode '{code or '(blank)'}'")
        if semester is None or not (1 <= semester <= 8):
            errors.append("Semester must be 1-8")
        if (
            teacher_subject_ids is not None
            and subject is not None
            and subject.id not in teacher_subject_ids
        ):
            errors.append(f"Subject {code} is not assigned to you")

        entry.update({"usn": usn, "subject_code": code, "semester": semester})

        if upload_type == "attendance":
            held = _num(rec.get("classesheld"))
            attended = _num(rec.get("classesattended"))
            if held is None or held < 0 or held > 500:
                errors.append("ClassesHeld must be 0-500")
            if attended is None or attended < 0:
                errors.append("ClassesAttended must be >= 0")
            if held is not None and attended is not None and attended > held:
                errors.append("ClassesAttended cannot exceed ClassesHeld")
            entry.update({"classes_held": held, "classes_attended": attended})
        elif upload_type == "ia":
            ia1 = _num(rec.get("ia1"))
            ia2 = _num(rec.get("ia2"))
            if ia1 is None or not (0 <= ia1 <= 50):
                errors.append("IA1 must be 0-50")
            if ia2 is None or not (0 <= ia2 <= 50):
                errors.append("IA2 must be 0-50")
            entry.update({"ia1": ia1, "ia2": ia2})
        else:  # assignment
            marks = _num(rec.get("assignmentmarks"))
            if marks is None or not (0 <= marks <= 10):
                errors.append("AssignmentMarks must be 0-10")
            entry.update({"assignment_marks": marks})

        if errors:
            err_count += 1
            entry["_status"] = "error"
            entry["_error"] = "; ".join(errors)
        else:
            entry["_status"] = "ok"
            entry["_student_id"] = student.id
            entry["_subject_id"] = subject.id
        rows.append(entry)

    return rows, err_count


def import_rows(upload_type: str, rows):
    """Upsert validated rows. Returns (inserted, updated, skipped)."""
    inserted = updated = skipped = 0
    affected_students = set()

    model_map = {"attendance": Attendance, "ia": IAMarks, "assignment": Assignment}
    Model = model_map[upload_type]

    for r in rows:
        if r["_status"] != "ok":
            skipped += 1
            continue
        sid, subj, sem = r["_student_id"], r["_subject_id"], int(r["semester"])
        obj = Model.query.filter_by(student_id=sid, subject_id=subj, semester=sem).first()
        if obj is None:
            obj = Model(student_id=sid, subject_id=subj, semester=sem)
            db.session.add(obj)
            inserted += 1
        else:
            updated += 1
        if upload_type == "attendance":
            obj.classes_held = int(r["classes_held"])
            obj.classes_attended = int(r["classes_attended"])
        elif upload_type == "ia":
            obj.ia1 = r["ia1"]
            obj.ia2 = r["ia2"]
        else:
            obj.marks = r["assignment_marks"]
        affected_students.add(sid)

    db.session.commit()
    return inserted, updated, skipped, affected_students
