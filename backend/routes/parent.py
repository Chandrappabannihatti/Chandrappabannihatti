from flask import Blueprint, jsonify

from models import Parent, ParentStudent
from services import ml_service
from services.analytics import student_summary
from services.helpers import current_user, error, role_required

parent_bp = Blueprint("parent", __name__, url_prefix="/api/parent")


@parent_bp.get("/dashboard")
@role_required("parent")
def dashboard():
    parent = Parent.query.filter_by(user_id=current_user().id).first()
    if parent is None:
        return error("Parent profile not found", 404)

    links = ParentStudent.query.filter_by(parent_id=parent.id).all()
    children = []
    for link in links:
        student = link.student
        ml_service.predict_for_student(student, store=True)  # keep risk fresh
        summary = student_summary(student, with_prediction=True)
        summary["relation"] = link.relation
        children.append(summary)

    return jsonify(
        {
            "parent": parent.dict(),
            "children": children,
        }
    )
