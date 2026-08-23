# CAMPS · Centralized Academic Monitoring & Prediction System

A production-shaped academic monitoring workspace for **PES Institute of Technology and Management**, Shivamogga. CAMPS connects department-scoped student records, attendance, internal marks, teacher communication, announcements, remarks and a prediction service in one responsive interface.

## What is included

- Premium university-style React/Vite frontend with React Router, Tailwind CSS, Axios, React Icons and Recharts.
- Node.js + Express REST API with JWT authentication, department-level teacher access control and role-aware endpoints.
- MySQL 8 schema covering departments, users, teachers, students, parents, attendance, internal marks, assignments, achievements, remarks, messages, announcements, predictions and notifications.
- `.xlsx` / `.csv` upload pipeline with server-side validation, duplicate USN detection, preview/import workflow and Excel export.
- Flask prediction service ready for a trained XGBoost `joblib` model. The API falls back to a transparent deterministic baseline when no model is mounted.
- Demo data and four ready-to-use demo roles: admin, teacher, student and parent.
- The entry flow is department → role → login. The root page presents responsive department cards, then tab-style Teacher/Student/Parent/Admin selection, followed by a clean role-specific login page. Marketing hero/promotional content is not used in the sign-in flow.
- Teacher tools: a department → semester → section hierarchy. After teacher login, `/teacher/semester/:semester` lists the available sections and supports **+ Add Section**; section workspaces use `/teacher/semester/:semester/section/:section` and isolate students, attendance, internal marks, assignments, achievements, remarks, messages, announcements, analytics and predictions. Search/filter/sort, full-page student profiles at `/teacher/student/:usn`, section-scoped manual entry (`/teacher/semester/:semester/section/:section/students/new`) and Excel import (`/teacher/semester/:semester/section/:section/students/upload`) cannot mix department, semester or section records.
- Full student profiles include personal details, photo/avatar, DOB, blood group, address, parent/guardian details, academic information, achievements, certifications, skills, teacher remarks and XGBoost prediction context. Profile, Settings and Logout are available to every authenticated role.
- Teachers can add a student achievement from `/teacher/semester/:semester/section/:section/achievements`. The Student selector is built from the current section only; saved records retain department, semester, section and student ownership and are available as read-only student/parent academic records.
- Read-only student and parent dashboards with attendance, marks, CGPA, prediction, achievements, remarks, messages and announcements.
- Admin subject management at `/admin/subjects`: choose Department → Semester, then add, edit or delete department/semester-owned subjects. The subject catalog is unique by `(department_code, semester, subject_code)` and the same active list is fetched by teacher, student and parent workspaces.
- Subject changes are synchronized end to end: teachers get subject-specific attendance and internal-mark entry immediately at `/teacher/semester/:semester/section/:section/attendance` and `/marks`, while student/parent records show the same catalog. The API and demo fallback retain scoped subject records and validation without a second setup step.

## Run locally in demo mode

Requirements: Node.js 18+, npm 9+.

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. The frontend is API-first by default and has a graceful local-data fallback, so the complete UI can still be reviewed without a database. To force local-only mode, set `VITE_DEMO_MODE=true`.

To run the REST API at the same time:

```bash
npm run server
```

The Vite proxy forwards `/api` requests to `http://localhost:5000`.

Or run both processes together:

```bash
npm run dev:full
```

### Demo accounts

The default review setup uses the same demo credentials in both the API and the client fallback.

| Role | Identifier | Password |
| --- | --- | --- |
| Admin | `admin@camps.edu` | `Admin@123` |
| Teacher | `teacher@camps.edu` | `Teacher@123` |
| Student | `4PM21CS033` | `Student@123` |
| Parent | `4PM21CS033` | `Parent@123` |

The demo teacher account is scoped to CSE. Select CSE → Teacher on the entry page, sign in, then open an isolated route such as `/teacher/semester/7/section/B`. Student and parent accounts open the read-only records for Ishita Kulkarni, including achievements. Admin accounts open the Department → Semester subject hierarchy; for example, CSE → Semester 7 contains the bundled subject catalog and supports synchronized CRUD.

## MySQL setup

1. Create a MySQL user and database (MySQL 8.0+).
2. Set `USE_DEMO_DATA=false` in `.env` and configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`.
3. Create the schema and seed the demo records:

```bash
npm run db:init
npm run db:seed
```

The schema is in [`database/schema.sql`](database/schema.sql), with department and subject seed notes in [`database/seed.sql`](database/seed.sql). `npm run db:init` also upgrades existing `students` tables with the expanded profile columns and widens legacy record-table subject codes for the shared catalog. Passwords are bcrypt-hashed by the seed script.

## Prediction service

The Node API accepts the following feature contract:

```json
{
  "attendance": 82,
  "ia1": 38,
  "ia2": 41,
  "assignmentMarks": 17,
  "previousSgpa": 8.1,
  "cgpa": 8.3,
  "backlogs": 0
}
```

Run the Flask service in a Python virtual environment:

```bash
cd ml-service
python -m venv .venv
. .venv/bin/activate       # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python app.py
```

Set `ML_SERVICE_URL=http://127.0.0.1:8000` in the Node `.env`. To use a trained model, place a binary classifier at `ml-service/model/camps_xgboost.joblib` or set `MODEL_PATH`. The model must expose `predict_proba` and consume the seven features in the order listed in `ml-service/app.py`.

## API surface

All routes except login and health require `Authorization: Bearer <jwt>`.

- `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/sections?semester=7`, `POST /api/sections` (teacher department is enforced; the POST body accepts `sectionName`)
- `GET /api/subjects?department=CSE&semester=7` (authenticated subject catalog for admin, teacher, student and parent scopes)
- `POST /api/subjects`, `PUT /api/subjects/:subjectId`, `DELETE /api/subjects/:subjectId` (admin-only subject CRUD with scoped validation)
- `GET /api/subjects/:subjectId/records`, `PUT /api/subjects/:subjectId/attendance`, `PUT /api/subjects/:subjectId/marks` (teacher/admin subject records and writes)
- `GET /api/students?semester=7&section=B`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id`
- `POST /api/students/upload`, `GET /api/students/export` (imports accept an optional section scope)
- `GET /api/messages`, `POST /api/messages/send`, `PUT /api/messages/:id/read`
- `GET /api/announcements`, `POST /api/announcements`, `PUT /api/announcements/:id`, `DELETE /api/announcements/:id`
- `GET /api/remarks`, `POST /api/remarks`
- `GET /api/achievements?semester=7&section=B`, `POST /api/achievements` (teacher/admin create; student and parent responses are read-only and scoped to their linked record)
- `POST /api/ml/predict`
- `GET /api/health`

Logout clears the stored JWT/session state and redirects to the unauthenticated department chooser at `/`.

## Production notes

- Replace `JWT_SECRET` with a long random secret and keep `.env` outside source control.
- Set `CLIENT_ORIGIN` to the deployed frontend origin and use HTTPS.
- Set `USE_DEMO_DATA=false` only after MySQL is reachable and the schema has been initialized.
- Add refresh-token rotation, rate limiting, object storage for large imports and an application logger before public deployment.
- Never use prediction risk as an automated decision; pair it with teacher context and a student conversation.
