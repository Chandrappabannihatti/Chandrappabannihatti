# CAMPS — Centralized Academic Monitoring & Prediction System Using Machine Learning

A production-style college academic monitoring platform. Attendance, IA marks,
assignments and semester results flow **Frontend → REST API → Flask → SQLAlchemy → MySQL**,
and an **XGBoost** model predicts each student's academic risk (**Low / Medium / High**)
plus a **pass probability**, giving faculty an early-warning system for at-risk students.

Built as a final-year engineering project with a modern SaaS-grade UI.

---

## ✨ Features

| Role | Capabilities |
|---|---|
| **Admin** | KPI dashboard (students, teachers, parents, avg attendance, avg SGPA, at-risk), risk pie chart, department bar chart, manage students/teachers/subjects/departments/parents, at-risk reports, ML analytics (feature importance, confusion matrix, live prediction console) |
| **Teacher** | Assigned-classes dashboard, per-class student list with risk badges, **Excel/CSV upload** (attendance / IA / assignments) with validation → preview → import, at-risk register |
| **Student** | Attendance, SGPA/CGPA, backlogs, subject-wise charts, SGPA trend, live **risk prediction card** with improvement tips |
| **Parent** | Read-only view of each child's profile, attendance, results, backlogs and risk prediction |

Plus: JWT auth with role guards, hashed passwords, per-row Excel validation with
error display, downloadable upload templates, notifications, and automatic
prediction refresh after every import.

## 🧱 Tech Stack

- **Frontend** — React 18, Vite, React Router, Axios, Tailwind CSS 4, Recharts
- **Backend** — Python Flask, Flask-JWT-Extended, SQLAlchemy 2, Pandas, OpenPyXL
- **ML** — XGBoost (`XGBClassifier` for risk level + `XGBRegressor` for pass probability), scikit-learn
- **Database** — MySQL 8 (schema + demo data in `database/`); SQLite default for zero-setup demo

## 📂 Project Structure

```
├── frontend/
│   └── src/
│       ├── components/      Layout, UI kit, charts, AcademicView
│       ├── context/         AuthContext (JWT + role)
│       ├── hooks/           useFetch
│       ├── pages/           admin/ teacher/ student/ parent/
│       └── services/        Axios instance (token interceptor)
├── backend/
│   ├── app.py               App factory + blueprints
│   ├── config.py            DATABASE_URL, JWT, model paths
│   ├── models/              15 SQLAlchemy models (normalized)
│   ├── routes/              auth · admin · teacher · student · parent · ml
│   ├── services/            ml_service, excel_service, analytics, helpers
│   ├── seed.py              Demo data seeder
│   ├── export_sql.py        DB → database/dummy_data.sql exporter
│   └── uploads/             (runtime uploads dir)
├── database/
│   ├── schema.sql           MySQL DDL (all 15 tables, FKs, indexes)
│   └── dummy_data.sql       MySQL INSERTs (generated from seeder)
├── ml/
│   ├── generate_dataset.py  2,500-row synthetic labeled dataset
│   ├── dataset.csv
│   ├── train.py             Full training pipeline → model.pkl + metrics.json
│   ├── predict.py           CLI prediction helper
│   └── model.pkl            Trained XGBoost bundle
└── sample_uploads/          Ready-to-import Excel/CSV demo files
```

## 🚀 Quick Start (zero-setup demo — SQLite)

**Prerequisites:** Python 3.10+, Node 18+

```bash
# 1. ML model (creates ml/dataset.csv, ml/model.pkl, ml/metrics.json)
cd ml
python3 -m venv ../backend/.venv        # or reuse any venv
../backend/.venv/bin/pip install -r ../backend/requirements.txt
../backend/.venv/bin/python generate_dataset.py
../backend/.venv/bin/python train.py

# 2. Backend (creates + seeds database/app.db automatically)
cd ../backend
../backend/.venv/bin/pip install -r requirements.txt   # if not done above
../backend/.venv/bin/python seed.py
../backend/.venv/bin/python app.py                     # http://localhost:5000

# 3. Frontend
cd ../frontend
npm install
npm run dev                                            # http://localhost:5173
```

Open **http://localhost:5173** and sign in with a demo account below.

## 🐬 Production Setup (MySQL)

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/dummy_data.sql

export DATABASE_URL="mysql+pymysql://root:password@localhost:3306/academic_monitoring"
cd backend && ../backend/.venv/bin/python app.py
```

> `dummy_data.sql` mirrors the seeder output. To regenerate it after reseeding:
> `cd backend && ../backend/.venv/bin/python export_sql.py`.

## 👥 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@college.com` | `Admin@123` |
| Teacher | `teacher@college.com` | `Teacher@123` |
| Student | `student@college.com` | `Student@123` |
| Parent | `parent@college.com` | `Parent@123` |

Seeded data: 3 departments (CSE/ISE/ECE), 10 subjects, 5 teachers, 20 students,
10 parents, and full attendance / IA / assignment / result / backlog / prediction records.
Try uploading `sample_uploads/attendance_cs501_502.xlsx` as the demo teacher —
`attendance_sample_with_errors.csv` demonstrates row-level validation errors.

## 🔌 REST API

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | JWT login |
| POST | `/api/auth/logout` | any | Logout |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/auth/notifications` | any | Notification feed |
| GET | `/api/admin/dashboard` | admin | KPIs, risk distribution, dept performance |
| GET/POST/DELETE | `/api/admin/students[/<id>]` | admin | Manage students |
| GET/POST/DELETE | `/api/admin/teachers[/<id>]` | admin | Manage teachers |
| GET/POST | `/api/admin/subjects` | admin | Manage subjects |
| GET/POST | `/api/admin/departments` | admin | Manage departments |
| GET/POST | `/api/admin/parents` | admin | Manage parents |
| GET | `/api/admin/reports/at-risk` | admin | At-risk register |
| GET | `/api/teacher/dashboard` | teacher | Classes + KPIs |
| GET | `/api/teacher/classes` | teacher | Assigned classes |
| GET | `/api/teacher/classes/<id>/students` | teacher | Class roster + risk |
| GET | `/api/teacher/at-risk` | teacher | At-risk across classes |
| POST | `/api/teacher/upload/<attendance\|ia\|assignment>` | teacher | Excel/CSV import (`mode=preview` → `mode=import`) |
| GET | `/api/teacher/upload/template/<type>` | teacher | Download .xlsx template |
| GET | `/api/student/dashboard` | student | Full academic snapshot + prediction |
| GET | `/api/student/attendance` | student | Subject-wise attendance |
| GET | `/api/student/results` | student | Results, IA, assignments, backlogs |
| GET | `/api/student/prediction` | student | Live XGBoost prediction |
| GET | `/api/parent/dashboard` | parent | Children snapshots (read-only) |
| POST | `/api/ml/predict` | any | Predict from raw features |
| GET | `/api/ml/feature-importance` | any | XGBoost gain importances |
| GET | `/api/ml/model-metrics` | any | Accuracy, F1, R², confusion matrix |

Example:

```bash
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"attendance_percentage":85,"assignment_marks":8,"previous_sem_sgpa":8.2,
       "cgpa":8.1,"backlogs":0,"ia1":42,"ia2":44}'
# → {"risk_level": "Low", "pass_probability": 88.8, "confidence": 100.0, ...}
```

## 🤖 ML Pipeline

```
dataset.csv → validation → preprocessing → feature engineering (avg_ia)
→ 80/20 stratified split → XGBClassifier (risk: Low/Medium/High)
                         → XGBRegressor  (pass_probability)
→ evaluation (accuracy 0.87, weighted-F1 0.87, R² 0.95) → model.pkl → /api/ml/*
```

**Features:** `attendance_percentage, assignment_marks, previous_sem_sgpa, cgpa,
backlogs, ia1, ia2, avg_ia`

At runtime the backend builds this vector straight from normalized MySQL tables
(`services/ml_service.py`), stores every prediction in `ml_predictions`, and
re-runs automatically after each Excel import — so dashboards never go stale.

Retrain any time:

```bash
cd ml && ../backend/.venv/bin/python generate_dataset.py && ../backend/.venv/bin/python train.py
```

## 🗄️ Database Schema (15 tables)

`roles · users · departments · subjects · teachers · teacher_subjects · students ·
parents · parent_student · attendance · ia_marks · assignments · semester_results ·
backlogs · ml_predictions · notifications`

All tables InnoDB with FK constraints and unique keys (e.g. one attendance row per
student/subject/semester → safe upserts during Excel import).

---

## 🎓 Viva / Report Cheat-Sheet

- **Why XGBoost?** Handles non-linear feature interactions (attendance × IA × backlogs), regularized gradient boosting resists overfitting on small campus datasets, and gives native feature-importance for explainability.
- **Why two models?** Classification answers *"how risky?"* (actionable bands), regression answers *"how likely to pass?"* (a continuous, motivating number for students).
- **Security:** salted password hashes (werkzeug scrypt), stateless JWT with role claims, role guard decorator on every blueprint, server-side ownership checks (teachers only see assigned classes; parents read-only).
- **Normalization:** 3NF — student/subject/semester fact tables with composite unique constraints make Excel upserts idempotent.

<details>
<summary>Original profile README</summary>

- 👋 Hi, I'm @Chandrappabannihatti
- 👀 I'm interested in ...c program
- 🌱 I'm currently learning ...3rd sem CSE
- 💞️ I'm looking to collaborate on ...
- 📫 How to reach me ...
- 😄 Pronouns: ...
- ⚡ Fun fact: ...
</details>
