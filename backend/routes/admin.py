from flask import Blueprint, jsonify, request
from sqlalchemy import func

from extensions import db
from models import (
    Attendance,
    Backlog,
    Department,
    MLPrediction,
    Notification,
    Parent,
    ParentStudent,
    Role,
    SemesterResult,
    Student,
    Subject,
    Teacher,
    TeacherSubject,
    User,
)
from services import ml_service
from services.analytics import (
    compact_student_row,
    dept_performance,
    results_stats,
    attendance_stats,
)
from services.helpers import current_user, error, role_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# ----------------------------------------------------------------------
# Dashboard
# ----------------------------------------------------------------------
@admin_bp.get("/dashboard")
@role_required("admin")
def dashboard():
    total_students = Student.query.count()
    total_teachers = Teacher.query.count()
    total_parents = Parent.query.count()
    total_subjects = Subject.query.count()

    # Average attendance across the institution
    held_att = db.session.query(
        func.sum(Attendance.classes_held),
        func.sum(Attendance.classes_attended),
    ).first()
    avg_attendance = (
        round(100 * (held_att[1] or 0) / held_att[0], 1) if held_att[0] else 0.0
    )

    avg_sgpa = round(db.session.query(func.avg(SemesterResult.sgpa)).scalar() or 0, 2)

    # At-risk counts from each student's latest prediction
    dist, at_risk = ml_service.latest_risk_distribution()
    risk_distribution = [{"name": k, "value": v} for k, v in dist.items()]

    recent = (
        MLPrediction.query.order_by(MLPrediction.created_at.desc()).limit(6).all()
    )
    recent_preds = []
    for p in recent:
        if p.student and p.student.user:
            recent_preds.append(
                {
                    "student": p.student.user.name,
                    "usn": p.student.usn,
                    "risk_level": p.risk_level,
                    "pass_probability": p.pass_probability,
                    "time": p.created_at.isoformat(),
                }
            )

    user = current_user()
    activities = (
        Notification.query.filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .limit(6)
        .all()
    )

    return jsonify(
        {
            "kpis": {
                "total_students": total_students,
                "total_teachers": total_teachers,
                "total_parents": total_parents,
                "total_subjects": total_subjects,
                "avg_attendance": avg_attendance,
                "avg_sgpa": avg_sgpa,
                "at_risk": at_risk,
            },
            "risk_distribution": risk_distribution,
            "dept_performance": dept_performance(),
            "recent_predictions": recent_preds,
            "recent_activities": [n.dict() for n in activities],
        }
    )


# ----------------------------------------------------------------------
# Students CRUD
# ----------------------------------------------------------------------
@admin_bp.get("/students")
@role_required("admin")
def list_students():
    dept = request.args.get("department")
    semester = request.args.get("semester", type=int)
    risk = request.args.get("risk")
    search = (request.args.get("search") or "").strip()

    q = Student.query.join(User, Student.user_id == User.id)
    if dept:
        q = q.join(Department, Student.department_id == Department.id).filter(
            Department.code == dept
        )
    if semester:
        q = q.filter(Student.semester == semester)
    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(User.name.ilike(like), Student.usn.ilike(like)))

    students = q.order_by(Student.usn).all()
    pred_map = ml_service.latest_predictions_map([s.id for s in students])
    rows = [compact_student_row(s, pred_map) for s in students]
    if risk:
        rows = [r for r in rows if (r["risk_level"] or "").lower() == risk.lower()]
    return jsonify({"students": rows, "count": len(rows)})


@admin_bp.post("/students")
@role_required("admin")
def create_student():
    data = request.get_json(silent=True) or {}
    required = ["name", "email", "usn", "department_id", "semester", "password"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        return error(f"Missing fields: {', '.join(missing)}", 400)
    if User.query.filter(db.func.lower(User.email) == data["email"].lower()).first():
        return error("Email already in use", 409)
    if Student.query.filter_by(usn=data["usn"].upper()).first():
        return error("USN already exists", 409)

    role = Role.query.filter_by(name="student").first()
    user = User(name=data["name"], email=data["email"].lower(), role_id=role.id)
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    student = Student(
        user_id=user.id,
        usn=data["usn"].upper(),
        department_id=data["department_id"],
        semester=int(data["semester"]),
        section=data.get("section", "A"),
        gender=data.get("gender"),
        phone=data.get("phone"),
        admission_year=data.get("admission_year"),
    )
    db.session.add(student)
    db.session.commit()
    return jsonify({"message": "Student created", "student": student.dict()}), 201


@admin_bp.delete("/students/<int:sid>")
@role_required("admin")
def delete_student(sid):
    student = Student.query.get_or_404(sid)
    user = User.query.get(student.user_id)
    ParentStudent.query.filter_by(student_id=sid).delete()
    db.session.delete(student)
    if user:
        db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Student deleted"})


# ----------------------------------------------------------------------
# Teachers CRUD
# ----------------------------------------------------------------------
@admin_bp.get("/teachers")
@role_required("admin")
def list_teachers():
    teachers = Teacher.query.join(User).order_by(User.name).all()
    out = []
    for t in teachers:
        row = t.dict()
        row["subjects"] = [
            {"code": ts.subject.code, "name": ts.subject.name, "section": ts.section}
            for ts in TeacherSubject.query.filter_by(teacher_id=t.id).all()
            if ts.subject
        ]
        out.append(row)
    return jsonify({"teachers": out, "count": len(out)})


@admin_bp.post("/teachers")
@role_required("admin")
def create_teacher():
    data = request.get_json(silent=True) or {}
    required = ["name", "email", "employee_id", "department_id", "password"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        return error(f"Missing fields: {', '.join(missing)}", 400)
    if User.query.filter(db.func.lower(User.email) == data["email"].lower()).first():
        return error("Email already in use", 409)

    role = Role.query.filter_by(name="teacher").first()
    user = User(name=data["name"], email=data["email"].lower(), role_id=role.id)
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    teacher = Teacher(
        user_id=user.id,
        employee_id=data["employee_id"],
        department_id=data["department_id"],
        designation=data.get("designation", "Assistant Professor"),
        phone=data.get("phone"),
    )
    db.session.add(teacher)
    db.session.flush()

    for subject_id in data.get("subject_ids", []):
        subject = Subject.query.get(subject_id)
        if subject:
            db.session.add(
                TeacherSubject(
                    teacher_id=teacher.id,
                    subject_id=subject.id,
                    semester=subject.semester,
                    section=data.get("section", "A"),
                )
            )
    db.session.commit()
    return jsonify({"message": "Teacher created", "teacher": teacher.dict()}), 201


@admin_bp.delete("/teachers/<int:tid>")
@role_required("admin")
def delete_teacher(tid):
    teacher = Teacher.query.get_or_404(tid)
    TeacherSubject.query.filter_by(teacher_id=tid).delete()
    user = User.query.get(teacher.user_id)
    db.session.delete(teacher)
    if user:
        db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Teacher deleted"})


# ----------------------------------------------------------------------
# Subjects & Departments & Parents
# ----------------------------------------------------------------------
@admin_bp.get("/subjects")
@role_required("admin", "teacher")
def list_subjects():
    subjects = Subject.query.order_by(Subject.department_id, Subject.semester).all()
    return jsonify({"subjects": [s.dict() for s in subjects]})


@admin_bp.post("/subjects")
@role_required("admin")
def create_subject():
    data = request.get_json(silent=True) or {}
    required = ["code", "name", "semester", "department_id"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        return error(f"Missing fields: {', '.join(missing)}", 400)
    if Subject.query.filter_by(code=data["code"].upper()).first():
        return error("Subject code already exists", 409)
    subject = Subject(
        code=data["code"].upper(),
        name=data["name"],
        semester=int(data["semester"]),
        credits=int(data.get("credits", 4)),
        department_id=data["department_id"],
    )
    db.session.add(subject)
    db.session.commit()
    return jsonify({"message": "Subject created", "subject": subject.dict()}), 201


@admin_bp.get("/departments")
@role_required("admin", "teacher")
def list_departments():
    depts = Department.query.order_by(Department.code).all()
    out = []
    for d in depts:
        out.append(
            {
                "id": d.id,
                "code": d.code,
                "name": d.name,
                "students": Student.query.filter_by(department_id=d.id).count(),
                "subjects": Subject.query.filter_by(department_id=d.id).count(),
                "teachers": Teacher.query.filter_by(department_id=d.id).count(),
            }
        )
    return jsonify({"departments": out})


@admin_bp.post("/departments")
@role_required("admin")
def create_department():
    data = request.get_json(silent=True) or {}
    if not data.get("code") or not data.get("name"):
        return error("code and name are required", 400)
    if Department.query.filter_by(code=data["code"].upper()).first():
        return error("Department code already exists", 409)
    dept = Department(code=data["code"].upper(), name=data["name"])
    db.session.add(dept)
    db.session.commit()
    return jsonify({"message": "Department created", "id": dept.id}), 201


@admin_bp.get("/parents")
@role_required("admin")
def list_parents():
    parents = Parent.query.join(User).order_by(User.name).all()
    out = []
    for p in parents:
        row = p.dict()
        row["children"] = [
            {
                "name": link.student.user.name if link.student and link.student.user else None,
                "usn": link.student.usn if link.student else None,
                "relation": link.relation,
            }
            for link in p.children
        ]
        out.append(row)
    return jsonify({"parents": out, "count": len(out)})


@admin_bp.post("/parents")
@role_required("admin")
def create_parent():
    data = request.get_json(silent=True) or {}
    required = ["name", "email", "password"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        return error(f"Missing fields: {', '.join(missing)}", 400)
    if User.query.filter(db.func.lower(User.email) == data["email"].lower()).first():
        return error("Email already in use", 409)

    role = Role.query.filter_by(name="parent").first()
    user = User(name=data["name"], email=data["email"].lower(), role_id=role.id)
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()
    parent = Parent(
        user_id=user.id, phone=data.get("phone"), occupation=data.get("occupation")
    )
    db.session.add(parent)
    db.session.flush()
    for sid in data.get("student_ids", []):
        if Student.query.get(sid):
            db.session.add(
                ParentStudent(
                    parent_id=parent.id, student_id=sid,
                    relation=data.get("relation", "Guardian"),
                )
            )
    db.session.commit()
    return jsonify({"message": "Parent created", "parent": parent.dict()}), 201


# ----------------------------------------------------------------------
# Reports
# ----------------------------------------------------------------------
@admin_bp.get("/reports/at-risk")
@role_required("admin")
def at_risk_report():
    students = Student.query.join(User).order_by(Student.usn).all()
    pred_map = ml_service.latest_predictions_map([s.id for s in students])
    rows = [compact_student_row(s, pred_map) for s in students]
    rows = [r for r in rows if r["risk_level"] in ("High", "Medium")]
    rows.sort(key=lambda r: (r["risk_level"] != "High", r["pass_probability"] or 0))
    return jsonify({"students": rows, "count": len(rows)})


@admin_bp.get("/reports/department")
@role_required("admin")
def department_report():
    return jsonify({"departments": dept_performance()})
