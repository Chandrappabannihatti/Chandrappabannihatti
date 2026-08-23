from datetime import datetime

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


class Role(db.Model):
    __tablename__ = "roles"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(32), unique=True, nullable=False)  # admin|teacher|student|parent

    users = db.relationship("User", back_populates="role", lazy=True)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    role = db.relationship("Role", back_populates="users")

    def set_password(self, raw: str):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        return check_password_hash(self.password_hash, raw)

    def public_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.name if self.role else None,
        }


class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(16), unique=True, nullable=False)


class Subject(db.Model):
    __tablename__ = "subjects"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(16), unique=True, nullable=False)
    name = db.Column(db.String(160), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    credits = db.Column(db.Integer, default=4)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False)

    department = db.relationship("Department")

    def dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "semester": self.semester,
            "credits": self.credits,
            "department_id": self.department_id,
            "department": self.department.code if self.department else None,
        }


class Teacher(db.Model):
    __tablename__ = "teachers"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    employee_id = db.Column(db.String(32), unique=True, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False)
    designation = db.Column(db.String(80), default="Assistant Professor")
    phone = db.Column(db.String(20))

    user = db.relationship("User")
    department = db.relationship("Department")

    def dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.user.name if self.user else None,
            "email": self.user.email if self.user else None,
            "employee_id": self.employee_id,
            "department_id": self.department_id,
            "department": self.department.code if self.department else None,
            "designation": self.designation,
            "phone": self.phone,
        }


class TeacherSubject(db.Model):
    """Assigns a teacher to a subject/semester/section (their 'class')."""
    __tablename__ = "teacher_subjects"
    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey("teachers.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(4), default="A")

    teacher = db.relationship("Teacher")
    subject = db.relationship("Subject")


class Student(db.Model):
    __tablename__ = "students"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    usn = db.Column(db.String(16), unique=True, nullable=False, index=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(4), default="A")
    gender = db.Column(db.String(12))
    phone = db.Column(db.String(20))
    admission_year = db.Column(db.Integer)

    user = db.relationship("User")
    department = db.relationship("Department")
    attendance = db.relationship("Attendance", back_populates="student", lazy=True)
    ia_marks = db.relationship("IAMarks", back_populates="student", lazy=True)
    assignments = db.relationship("Assignment", back_populates="student", lazy=True)
    results = db.relationship("SemesterResult", back_populates="student", lazy=True)
    backlogs = db.relationship("Backlog", back_populates="student", lazy=True)

    def dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.user.name if self.user else None,
            "email": self.user.email if self.user else None,
            "usn": self.usn,
            "department_id": self.department_id,
            "department": self.department.code if self.department else None,
            "semester": self.semester,
            "section": self.section,
            "gender": self.gender,
            "phone": self.phone,
            "admission_year": self.admission_year,
        }


class Parent(db.Model):
    __tablename__ = "parents"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    occupation = db.Column(db.String(80))

    user = db.relationship("User")
    children = db.relationship("ParentStudent", back_populates="parent", lazy=True)

    def dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.user.name if self.user else None,
            "email": self.user.email if self.user else None,
            "phone": self.phone,
            "occupation": self.occupation,
        }


class ParentStudent(db.Model):
    __tablename__ = "parent_student"
    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("parents.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    relation = db.Column(db.String(24), default="Guardian")

    parent = db.relationship("Parent", back_populates="children")
    student = db.relationship("Student")
    __table_args__ = (db.UniqueConstraint("parent_id", "student_id"),)


class Attendance(db.Model):
    __tablename__ = "attendance"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    classes_held = db.Column(db.Integer, default=0)
    classes_attended = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = db.relationship("Student", back_populates="attendance")
    subject = db.relationship("Subject")
    __table_args__ = (db.UniqueConstraint("student_id", "subject_id", "semester"),)

    @property
    def percentage(self):
        return round(100 * self.classes_attended / self.classes_held, 1) if self.classes_held else 0.0


class IAMarks(db.Model):
    __tablename__ = "ia_marks"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    ia1 = db.Column(db.Float, default=0)   # out of 50
    ia2 = db.Column(db.Float, default=0)   # out of 50

    student = db.relationship("Student", back_populates="ia_marks")
    subject = db.relationship("Subject")
    __table_args__ = (db.UniqueConstraint("student_id", "subject_id", "semester"),)


class Assignment(db.Model):
    __tablename__ = "assignments"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    marks = db.Column(db.Float, default=0)  # out of 10

    student = db.relationship("Student", back_populates="assignments")
    subject = db.relationship("Subject")
    __table_args__ = (db.UniqueConstraint("student_id", "subject_id", "semester"),)


class SemesterResult(db.Model):
    __tablename__ = "semester_results"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    sgpa = db.Column(db.Float, nullable=False)
    cgpa = db.Column(db.Float, nullable=False)
    published_on = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship("Student", back_populates="results")
    __table_args__ = (db.UniqueConstraint("student_id", "semester"),)


class Backlog(db.Model):
    __tablename__ = "backlogs"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(16), default="active")  # active | cleared

    student = db.relationship("Student", back_populates="backlogs")
    subject = db.relationship("Subject")


class MLPrediction(db.Model):
    __tablename__ = "ml_predictions"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)
    semester = db.Column(db.Integer)
    risk_level = db.Column(db.String(16), nullable=False)  # Low | Medium | High
    pass_probability = db.Column(db.Float, nullable=False)
    confidence = db.Column(db.Float)
    features_json = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    student = db.relationship("Student")

    def dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "risk_level": self.risk_level,
            "pass_probability": self.pass_probability,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.String(500))
    kind = db.Column(db.String(24), default="info")  # info|success|warning|danger
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "kind": self.kind,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
