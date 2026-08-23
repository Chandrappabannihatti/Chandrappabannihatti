import io
from datetime import datetime

import pandas as pd
from flask import Blueprint, jsonify, request, send_file
from sqlalchemy import func

from extensions import db
from models import (
    Assignment,
    Attendance,
    IAMarks,
    Notification,
    Student,
    Subject,
    Teacher,
    TeacherSubject,
)
from services import excel_service, ml_service
from services.analytics import class_student_ids
from services.excel_service import UploadError
from services.helpers import current_user, error, role_required

teacher_bp = Blueprint("teacher", __name__, url_prefix="/api/teacher")


def _teacher():
    user = current_user()
    return Teacher.query.filter_by(user_id=user.id).first()


def _teacher_classes(teacher):
    assignments = (
        TeacherSubject.query.filter_by(teacher_id=teacher.id)
        .join(Subject, TeacherSubject.subject_id == Subject.id)
        .order_by(Subject.code)
        .all()
    )
    classes = []
    for ts in assignments:
        sids = class_student_ids(ts.subject_id, ts.semester, ts.section)
        att = (
            db.session.query(
                func.sum(Attendance.classes_held), func.sum(Attendance.classes_attended)
            )
            .filter(Attendance.subject_id == ts.subject_id, Attendance.student_id.in_(sids or [0]))
            .first()
        )
        avg_att = round(100 * (att[1] or 0) / att[0], 1) if att[0] else 0.0
        ia_count = IAMarks.query.filter(
            IAMarks.subject_id == ts.subject_id, IAMarks.student_id.in_(sids or [0])
        ).count()
        pred_map = ml_service.latest_predictions_map(sids)
        at_risk = sum(1 for p in pred_map.values() if p.risk_level == "High")
        classes.append(
            {
                "id": ts.id,
                "subject_id": ts.subject_id,
                "subject_code": ts.subject.code,
                "subject_name": ts.subject.name,
                "semester": ts.semester,
                "section": ts.section,
                "credits": ts.subject.credits,
                "students_count": len(sids),
                "avg_attendance": avg_att,
                "ia_completion": round(100 * ia_count / len(sids), 1) if sids else 0,
                "at_risk": at_risk,
            }
        )
    return classes


@teacher_bp.get("/dashboard")
@role_required("teacher")
def dashboard():
    teacher = _teacher()
    classes = _teacher_classes(teacher)
    # Unique students across all assigned classes
    all_sids = set()
    for ts in TeacherSubject.query.filter_by(teacher_id=teacher.id).all():
        all_sids.update(class_student_ids(ts.subject_id, ts.semester, ts.section))
    total_students = len(all_sids)
    avg_att = (
        round(sum(c["avg_attendance"] for c in classes) / len(classes), 1)
        if classes else 0
    )
    ia_completion = (
        round(sum(c["ia_completion"] for c in classes) / len(classes), 1)
        if classes else 0
    )
    at_risk = sum(
        1
        for p in ml_service.latest_predictions_map(list(all_sids)).values()
        if p.risk_level == "High"
    )

    return jsonify(
        {
            "teacher": {"name": current_user().name, "department": teacher.department.code},
            "kpis": {
                "classes": len(classes),
                "total_students": total_students,
                "avg_attendance": avg_att,
                "ia_completion": ia_completion,
                "at_risk": at_risk,
            },
            "classes": classes,
        }
    )


@teacher_bp.get("/classes")
@role_required("teacher")
def classes():
    return jsonify({"classes": _teacher_classes(_teacher())})


@teacher_bp.get("/classes/<int:ts_id>/students")
@role_required("teacher")
def class_students(ts_id):
    teacher = _teacher()
    ts = TeacherSubject.query.get_or_404(ts_id)
    if ts.teacher_id != teacher.id:
        return error("This class is not assigned to you", 403)

    sids = class_student_ids(ts.subject_id, ts.semester, ts.section)
    students = Student.query.filter(Student.id.in_(sids or [0])).all()
    pred_map = ml_service.latest_predictions_map(sids)

    rows = []
    for s in students:
        att = Attendance.query.filter_by(
            student_id=s.id, subject_id=ts.subject_id
        ).first()
        ia = IAMarks.query.filter_by(student_id=s.id, subject_id=ts.subject_id).first()
        assg = Assignment.query.filter_by(
            student_id=s.id, subject_id=ts.subject_id
        ).first()
        pred = pred_map.get(s.id)
        rows.append(
            {
                "id": s.id,
                "usn": s.usn,
                "name": s.user.name if s.user else None,
                "attendance_percentage": att.percentage if att else None,
                "classes_held": att.classes_held if att else 0,
                "classes_attended": att.classes_attended if att else 0,
                "ia1": ia.ia1 if ia else None,
                "ia2": ia.ia2 if ia else None,
                "assignment_marks": assg.marks if assg else None,
                "risk_level": pred.risk_level if pred else None,
                "pass_probability": pred.pass_probability if pred else None,
            }
        )
    rows.sort(key=lambda r: r["usn"])
    return jsonify(
        {
            "class": {
                "id": ts.id,
                "subject_code": ts.subject.code,
                "subject_name": ts.subject.name,
                "semester": ts.semester,
                "section": ts.section,
            },
            "students": rows,
        }
    )


@teacher_bp.get("/at-risk")
@role_required("teacher")
def at_risk():
    teacher = _teacher()
    classes = _teacher_classes(teacher)
    out = []
    for c in classes:
        sids = class_student_ids(c["subject_id"], c["semester"], c["section"])
        students = Student.query.filter(Student.id.in_(sids or [0])).all()
        pred_map = ml_service.latest_predictions_map(sids)
        for s in students:
            pred = pred_map.get(s.id)
            if pred and pred.risk_level in ("High", "Medium"):
                out.append(
                    {
                        "usn": s.usn,
                        "name": s.user.name if s.user else None,
                        "subject_code": c["subject_code"],
                        "risk_level": pred.risk_level,
                        "pass_probability": pred.pass_probability,
                    }
                )
    out.sort(key=lambda r: (r["risk_level"] != "High", r["pass_probability"]))
    return jsonify({"students": out, "count": len(out)})


# ----------------------------------------------------------------------
# Excel / CSV uploads
# ----------------------------------------------------------------------
@teacher_bp.post("/upload/<upload_type>")
@role_required("teacher")
def upload(upload_type):
    if upload_type not in excel_service.UPLOAD_SPECS:
        return error("Unknown upload type. Use attendance | ia | assignment", 404)
    if "file" not in request.files:
        return error("No file part in the request", 400)
    file = request.files["file"]
    if not file.filename:
        return error("No file selected", 400)
    mode = request.form.get("mode", "preview")

    teacher = _teacher()
    subject_ids = {
        ts.subject_id for ts in TeacherSubject.query.filter_by(teacher_id=teacher.id)
    }

    try:
        rows, err_count = excel_service.parse_and_validate(
            upload_type, file, teacher_subject_ids=subject_ids
        )
    except UploadError as exc:
        return error(str(exc), 422)

    if mode == "preview":
        clean = [{k: v for k, v in r.items() if not k.startswith("_") or k in ("_status", "_error")} for r in rows]
        return jsonify(
            {
                "mode": "preview",
                "rows": clean,
                "total": len(rows),
                "valid": len(rows) - err_count,
                "errors": err_count,
            }
        )

    inserted, updated, skipped, affected = excel_service.import_rows(upload_type, rows)

    # Re-run ML predictions for affected students so risk scores stay fresh.
    students = Student.query.filter(Student.id.in_(affected or [0])).all()
    for s in students:
        ml_service.predict_for_student(s, store=True)

    label = excel_service.UPLOAD_SPECS[upload_type]["label"]
    db.session.add(
        Notification(
            user_id=current_user().id,
            title=f"{label} import complete",
            message=f"{inserted} new, {updated} updated, {skipped} skipped rows. Predictions refreshed for {len(affected)} students.",
            kind="success" if skipped == 0 else "warning",
        )
    )
    db.session.commit()

    clean = [{k: v for k, v in r.items() if not k.startswith("_") or k in ("_status", "_error")} for r in rows if r["_status"] == "error"]
    return jsonify(
        {
            "mode": "import",
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped,
            "students_updated": len(affected),
            "errors": clean,
        }
    )


@teacher_bp.get("/upload/template/<upload_type>")
@role_required("teacher")
def upload_template(upload_type):
    templates = {
        "attendance": {
            "USN": ["1CR23CS001", "1CR23CS002"],
            "SubjectCode": ["CS501", "CS501"],
            "Semester": [5, 5],
            "ClassesHeld": [40, 40],
            "ClassesAttended": [36, 31],
        },
        "ia": {
            "USN": ["1CR23CS001", "1CR23CS002"],
            "SubjectCode": ["CS501", "CS501"],
            "Semester": [5, 5],
            "IA1": [42, 35],
            "IA2": [44, 38],
        },
        "assignment": {
            "USN": ["1CR23CS001", "1CR23CS002"],
            "SubjectCode": ["CS501", "CS501"],
            "Semester": [5, 5],
            "AssignmentMarks": [8, 7],
        },
    }
    data = templates.get(upload_type)
    if data is None:
        return error("Unknown template type", 404)
    buf = io.BytesIO()
    pd.DataFrame(data).to_excel(buf, index=False, engine="openpyxl")
    buf.seek(0)
    return send_file(
        buf,
        as_attachment=True,
        download_name=f"{upload_type}_template.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@teacher_bp.get("/activity")
@role_required("teacher")
def activity():
    notes = (
        Notification.query.filter_by(user_id=current_user().id)
        .order_by(Notification.created_at.desc())
        .limit(6)
        .all()
    )
    return jsonify({"activities": [n.dict() for n in notes]})
