"""Aggregate queries powering the role dashboards."""
from sqlalchemy import func

from extensions import db
from models import (
    Assignment,
    Attendance,
    Backlog,
    Department,
    IAMarks,
    SemesterResult,
    Student,
    Subject,
)
from services import ml_service


def attendance_stats(student_id):
    rows = (
        db.session.query(
            Subject.code, Subject.name, Subject.credits,
            Attendance.classes_held, Attendance.classes_attended,
        )
        .join(Attendance, Attendance.subject_id == Subject.id)
        .filter(Attendance.student_id == student_id)
        .order_by(Subject.code)
        .all()
    )
    subjects = [
        {
            "subject_code": r.code,
            "subject_name": r.name,
            "classes_held": r.classes_held,
            "classes_attended": r.classes_attended,
            "percentage": round(100 * r.classes_attended / r.classes_held, 1)
            if r.classes_held else 0.0,
        }
        for r in rows
    ]
    held = sum(s["classes_held"] for s in subjects)
    attended = sum(s["classes_attended"] for s in subjects)
    overall = round(100 * attended / held, 1) if held else 0.0
    return overall, subjects


def results_stats(student_id):
    results = (
        SemesterResult.query.filter_by(student_id=student_id)
        .order_by(SemesterResult.semester)
        .all()
    )
    trend = [{"semester": f"Sem {r.semester}", "sgpa": r.sgpa, "cgpa": r.cgpa} for r in results]
    cgpa = round(sum(r.sgpa for r in results) / len(results), 2) if results else 0.0
    sgpa = results[-1].sgpa if results else 0.0
    return sgpa, cgpa, trend


def backlog_stats(student_id):
    items = Backlog.query.filter_by(student_id=student_id).all()
    active = [b for b in items if b.status == "active"]
    detail = [
        {
            "subject_code": b.subject.code if b.subject else None,
            "subject_name": b.subject.name if b.subject else None,
            "semester": b.semester,
            "status": b.status,
        }
        for b in items
    ]
    return len(active), detail


def ia_stats(student_id):
    rows = (
        db.session.query(Subject.code, Subject.name, IAMarks.ia1, IAMarks.ia2)
        .join(IAMarks, IAMarks.subject_id == Subject.id)
        .filter(IAMarks.student_id == student_id)
        .order_by(Subject.code)
        .all()
    )
    return [
        {
            "subject_code": r.code,
            "subject_name": r.name,
            "ia1": r.ia1,
            "ia2": r.ia2,
            "avg": round((r.ia1 + r.ia2) / 2, 1),
        }
        for r in rows
    ]


def assignment_stats(student_id):
    rows = (
        db.session.query(Subject.code, Subject.name, Assignment.marks)
        .join(Assignment, Assignment.subject_id == Subject.id)
        .filter(Assignment.student_id == student_id)
        .order_by(Subject.code)
        .all()
    )
    return [
        {"subject_code": r.code, "subject_name": r.name, "marks": r.marks}
        for r in rows
    ]


def student_summary(student: Student, with_prediction=True) -> dict:
    """Full academic snapshot used by student & parent dashboards."""
    attendance_pct, subjects = attendance_stats(student.id)
    sgpa, cgpa, trend = results_stats(student.id)
    backlog_count, backlog_detail = backlog_stats(student.id)

    summary = {
        "profile": student.dict(),
        "attendance_percentage": attendance_pct,
        "subject_attendance": subjects,
        "sgpa": sgpa,
        "cgpa": cgpa,
        "sgpa_trend": trend,
        "backlogs": backlog_count,
        "backlog_detail": backlog_detail,
        "ia_marks": ia_stats(student.id),
        "assignments": assignment_stats(student.id),
    }
    if with_prediction:
        pred = ml_service.latest_prediction(student.id)
        if pred is None:
            # Cold-start: compute on demand and persist.
            result = ml_service.predict_for_student(student)
            summary["prediction"] = {
                "risk_level": result.get("risk_level"),
                "pass_probability": result.get("pass_probability"),
                "confidence": result.get("confidence"),
                "class_probabilities": result.get("class_probabilities"),
                "features": result.get("features"),
            }
        else:
            summary["prediction"] = pred.dict()
    return summary


def compact_student_row(student: Student, pred_map=None) -> dict:
    """Row used in admin/teacher list views."""
    attendance_pct, _ = attendance_stats(student.id)
    sgpa, cgpa, _ = results_stats(student.id)
    backlogs, _ = backlog_stats(student.id)
    pred = (pred_map or {}).get(student.id) or ml_service.latest_prediction(student.id)
    row = student.dict()
    row.update(
        {
            "attendance_percentage": attendance_pct,
            "sgpa": sgpa,
            "cgpa": cgpa,
            "backlogs": backlogs,
            "risk_level": pred.risk_level if pred else None,
            "pass_probability": pred.pass_probability if pred else None,
        }
    )
    return row


def dept_performance():
    depts = Department.query.all()
    out = []
    for d in depts:
        students = Student.query.filter_by(department_id=d.id).all()
        if not students:
            out.append({"department": d.code, "avg_sgpa": 0, "avg_attendance": 0, "students": 0})
            continue
        sgpas, atts = [], []
        for s in students:
            _, _, trend = None, None, None
            sgpa, _, _ = results_stats(s.id)
            att, _ = attendance_stats(s.id)
            if sgpa:
                sgpas.append(sgpa)
            if att:
                atts.append(att)
        out.append(
            {
                "department": d.code,
                "avg_sgpa": round(sum(sgpas) / len(sgpas), 2) if sgpas else 0,
                "avg_attendance": round(sum(atts) / len(atts), 1) if atts else 0,
                "students": len(students),
            }
        )
    return out


def class_student_ids(subject_id, semester, section):
    """Students belonging to a class = same dept/semester/section as the subject."""
    subject = Subject.query.get(subject_id)
    if subject is None:
        return []
    rows = Student.query.filter_by(
        department_id=subject.department_id, semester=semester, section=section
    ).all()
    return [s.id for s in rows]
