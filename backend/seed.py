"""
Seeds the database with realistic demo data:

  3 departments, 10 subjects, 5 teachers, 20 students, 10 parents,
  attendance / IA / assignment records, semester results, backlogs,
  ML predictions and notifications.

Run:  python seed.py          (idempotent — wipes and recreates)
"""
import random

from app import create_app
from extensions import db
from models import (
    Assignment,
    Attendance,
    Backlog,
    Department,
    IAMarks,
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

rng = random.Random(7)

DEMO_PASSWORDS = {
    "admin@college.com": "Admin@123",
    "teacher@college.com": "Teacher@123",
    "student@college.com": "Student@123",
    "parent@college.com": "Parent@123",
}

DEPARTMENTS = [
    ("CSE", "Computer Science and Engineering"),
    ("ISE", "Information Science and Engineering"),
    ("ECE", "Electronics and Communication Engineering"),
]

SUBJECTS = [
    ("CS501", "Machine Learning", 5, 4, "CSE"),
    ("CS502", "Database Management Systems", 5, 4, "CSE"),
    ("CS503", "Computer Networks", 5, 3, "CSE"),
    ("CS504", "Operating Systems", 5, 4, "CSE"),
    ("IS501", "Data Analytics", 5, 4, "ISE"),
    ("IS502", "Web Technologies", 5, 3, "ISE"),
    ("IS503", "Cloud Computing", 5, 3, "ISE"),
    ("EC501", "Digital Signal Processing", 5, 4, "ECE"),
    ("EC502", "VLSI Design", 5, 3, "ECE"),
    ("EC503", "Embedded Systems", 5, 4, "ECE"),
]

FIRST_NAMES = [
    "Aarav", "Diya", "Rohan", "Sneha", "Kiran", "Ananya", "Vikram", "Priya",
    "Arjun", "Meera", "Rahul", "Ishita", "Aditya", "Nandini", "Suresh",
    "Kavya", "Manoj", "Pooja", "Tejas", "Ritika",
]
LAST_NAMES = [
    "Sharma", "Patil", "Reddy", "Kulkarni", "Iyer", "Desai", "Gowda",
    "Nair", "Bhat", "Hegde", "Rao", "Joshi", "Kumar", "Shetty", "Verma",
    "Pillai", "Das", "Menon", "Singh", "Chavan",
]
TEACHER_NAMES = [
    "Dr. Ramesh Kulkarni", "Prof. Asha Nair", "Dr. Sanjay Verma",
    "Prof. Lakshmi Iyer", "Dr. Prakash Gowda",
]


def strength_profile():
    # ~60% average, 20% strong, 20% weak
    r = rng.random()
    if r < 0.2:
        return rng.uniform(0.8, 0.97)
    if r < 0.8:
        return rng.uniform(0.55, 0.8)
    return rng.uniform(0.3, 0.55)


def seed():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        roles = {name: Role(name=name) for name in ("admin", "teacher", "student", "parent")}
        db.session.add_all(roles.values())
        db.session.flush()

        depts = {code: Department(code=code, name=name) for code, name in DEPARTMENTS}
        db.session.add_all(depts.values())
        db.session.flush()

        subjects = {}
        for code, name, sem, credits, dcode in SUBJECTS:
            subj = Subject(code=code, name=name, semester=sem, credits=credits,
                           department_id=depts[dcode].id)
            db.session.add(subj)
            subjects[code] = subj
        db.session.flush()

        # ---------------- Users ----------------
        def make_user(name, email, password, role):
            u = User(name=name, email=email, role_id=roles[role].id)
            u.set_password(password)
            db.session.add(u)
            db.session.flush()
            return u

        make_user("System Admin", "admin@college.com", "Admin@123", "admin")

        teachers = []
        for i, tname in enumerate(TEACHER_NAMES):
            email = "teacher@college.com" if i == 0 else f"teacher{i+1}@college.com"
            pwd = DEMO_PASSWORDS.get(email, "Teacher@123")
            dcode = ["CSE", "CSE", "ISE", "ECE", "CSE"][i]
            user = make_user(tname, email, pwd, "teacher")
            t = Teacher(user_id=user.id, employee_id=f"EMP{100+i}",
                        department_id=depts[dcode].id,
                        designation="Professor" if tname.startswith("Dr.") else "Assistant Professor",
                        phone=f"98450{10000+i}")
            db.session.add(t)
            teachers.append(t)
        db.session.flush()

        assignments = [
            (0, ["CS501", "CS502"]), (1, ["CS503", "CS504"]),
            (2, ["IS501", "IS502", "IS503"]),
            (3, ["EC501", "EC502", "EC503"]), (4, ["CS501", "CS504"]),
        ]
        for t_idx, codes in assignments:
            for code in codes:
                db.session.add(TeacherSubject(
                    teacher_id=teachers[t_idx].id,
                    subject_id=subjects[code].id,
                    semester=subjects[code].semester, section="A"))

        # ---------------- Students ----------------
        dept_plan = [("CSE", 8), ("ISE", 6), ("ECE", 6)]
        students = []
        idx = 0
        for dcode, count in dept_plan:
            for j in range(count):
                idx += 1
                name = f"{FIRST_NAMES[idx-1]} {LAST_NAMES[idx-1]}"
                if idx == 1:
                    email = "student@college.com"
                else:
                    email = f"{name.split()[0].lower()}{idx}@college.com"
                pwd = DEMO_PASSWORDS.get(email, "Student@123")
                user = make_user(name, email, pwd, "student")
                usn = f"1CR23{dcode[:2].upper()}{idx:03d}"
                s = Student(user_id=user.id, usn=usn, department_id=depts[dcode].id,
                            semester=5, section="A",
                            gender="Female" if idx % 3 == 0 else "Male",
                            phone=f"99000{20000+idx}", admission_year=2023)
                db.session.add(s)
                students.append((s, strength_profile()))
        db.session.flush()

        # ---------------- Parents (each with 2 children) ----------------
        parents = []
        for i in range(10):
            pname = f"{LAST_NAMES[(i*2) % 20]} {'Senior' if i % 2 else 'Family'} Parent"
            # Make parent names realistic: use last name of first child pair
            c1 = students[i * 2][0]
            pname = f"Parent of {c1.user.name.split()[0]}"
            email = "parent@college.com" if i == 0 else f"parent{i+1}@college.com"
            pwd = DEMO_PASSWORDS.get(email, "Parent@123")
            user = make_user(pname, email, pwd, "parent")
            p = Parent(user_id=user.id, phone=f"98111{30000+i}",
                       occupation=rng.choice(["Farmer", "Engineer", "Teacher", "Business", "Doctor"]))
            db.session.add(p)
            db.session.flush()
            parents.append(p)
            for k in (0, 1):
                db.session.add(ParentStudent(
                    parent_id=p.id, student_id=students[i * 2 + k][0].id,
                    relation="Father" if i % 2 == 0 else "Mother"))
        db.session.flush()

        # ---------------- Academic records ----------------
        dept_subjects = {}
        for code, subj in subjects.items():
            dept_subjects.setdefault(subj.department_id, []).append(subj)

        for student, strength in students:
            subj_list = dept_subjects[student.department_id]
            for subj in subj_list:
                held = rng.randint(38, 46)
                attended = min(held, max(8, int(round(rng.gauss(strength * held, 4)))))
                db.session.add(Attendance(student_id=student.id, subject_id=subj.id,
                                          semester=student.semester,
                                          classes_held=held, classes_attended=attended))
                ia1 = min(50, max(4, round(rng.gauss(strength * 50, 6), 1)))
                ia2 = min(50, max(4, round(ia1 + rng.gauss(1.5, 4), 1)))
                db.session.add(IAMarks(student_id=student.id, subject_id=subj.id,
                                       semester=student.semester, ia1=ia1, ia2=ia2))
                db.session.add(Assignment(student_id=student.id, subject_id=subj.id,
                                          semester=student.semester,
                                          marks=min(10, max(1, round(rng.gauss(strength * 10, 1.3), 1)))))

            # Semester results for semesters 1-4 with growth noise
            base = min(9.9, max(3.5, rng.gauss(strength * 10, 0.6)))
            cgpas = []
            for sem in range(1, 5):
                sgpa = min(10.0, max(3.0, round(base + rng.gauss(0, 0.45), 2)))
                cgpas.append(sgpa)
                db.session.add(SemesterResult(student_id=student.id, semester=sem,
                                              sgpa=sgpa, cgpa=round(sum(cgpas) / len(cgpas), 2)))

            # Backlogs for weak students
            if strength < 0.5:
                n_back = rng.randint(1, 3)
                for b in rng.sample(subj_list, min(n_back, len(subj_list))):
                    db.session.add(Backlog(student_id=student.id, subject_id=b.id,
                                           semester=rng.choice([3, 4]), status="active"))

        db.session.commit()

        # ---------------- ML predictions ----------------
        for student, _ in students:
            ml_service.predict_for_student(student, store=True)

        # ---------------- Notifications ----------------
        admin_user = User.query.filter_by(email="admin@college.com").first()
        teacher_user = User.query.filter_by(email="teacher@college.com").first()
        student_user = User.query.filter_by(email="student@college.com").first()
        parent_user = User.query.filter_by(email="parent@college.com").first()

        notes = [
            (admin_user, "Welcome to CAMPS", "Centralized Academic Monitoring and Prediction System is live for AY 2025-26.", "info"),
            (admin_user, "Semester 5 monitoring started", "Attendance and IA tracking enabled for CSE, ISE and ECE.", "info"),
            (admin_user, "At-risk students detected", "XGBoost model flagged students with high academic risk. Review the Reports section.", "danger"),
            (teacher_user, "Upload window open", "IA-2 marks and attendance upload for semester 5 is now open.", "info"),
            (teacher_user, "Attendance defaulters", "Some students in your classes are below 75% attendance.", "warning"),
            (student_user, "IA-2 marks published", "Your IA-2 marks for semester 5 subjects are now visible.", "success"),
            (student_user, "Risk prediction updated", "Your academic risk prediction has been refreshed with the latest data.", "info"),
            (parent_user, "Monthly report ready", "Your ward's attendance and performance summary has been updated.", "info"),
            (parent_user, "Teacher meeting", "Parent-teacher meeting scheduled for the last week of this month.", "warning"),
        ]
        for user, title, msg, kind in notes:
            db.session.add(Notification(user_id=user.id, title=title, message=msg, kind=kind))
        db.session.commit()

        print("Seed complete:")
        print(f"  departments={Department.query.count()} subjects={Subject.query.count()}")
        print(f"  teachers={Teacher.query.count()} students={Student.query.count()} parents={Parent.query.count()}")
        print(f"  attendance={Attendance.query.count()} ia={IAMarks.query.count()} assignments={Assignment.query.count()}")
        print(f"  results={SemesterResult.query.count()} backlogs={Backlog.query.count()}")
        print(f"  predictions={MLPrediction.query.count()}")


if __name__ == "__main__":
    seed()
