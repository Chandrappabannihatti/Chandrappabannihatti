from flask import Blueprint, jsonify

from models import Backlog, SemesterResult, Student
from services import ml_service
from services.analytics import (
    assignment_stats,
    attendance_stats,
    ia_stats,
    student_summary,
)
from services.helpers import current_user, error, role_required

student_bp = Blueprint("student", __name__, url_prefix="/api/student")


def _student():
    return Student.query.filter_by(user_id=current_user().id).first()


@student_bp.get("/dashboard")
@role_required("student")
def dashboard():
    student = _student()
    if student is None:
        return error("Student profile not found", 404)
    # Refresh prediction so the dashboard always reflects latest data.
    ml_service.predict_for_student(student, store=True)
    return jsonify(student_summary(student, with_prediction=True))


@student_bp.get("/attendance")
@role_required("student")
def attendance():
    student = _student()
    overall, subjects = attendance_stats(student.id)
    return jsonify({"overall": overall, "subjects": subjects})


@student_bp.get("/results")
@role_required("student")
def results():
    student = _student()
    rows = (
        SemesterResult.query.filter_by(student_id=student.id)
        .order_by(SemesterResult.semester)
        .all()
    )
    backlogs = Backlog.query.filter_by(student_id=student.id).all()
    return jsonify(
        {
            "results": [
                {"semester": r.semester, "sgpa": r.sgpa, "cgpa": r.cgpa} for r in rows
            ],
            "backlogs": [
                {
                    "subject_code": b.subject.code if b.subject else None,
                    "subject_name": b.subject.name if b.subject else None,
                    "semester": b.semester,
                    "status": b.status,
                }
                for b in backlogs
            ],
            "ia_marks": ia_stats(student.id),
            "assignments": assignment_stats(student.id),
        }
    )


@student_bp.get("/prediction")
@role_required("student")
def prediction():
    student = _student()
    result = ml_service.predict_for_student(student, store=True)
    return jsonify(result)
