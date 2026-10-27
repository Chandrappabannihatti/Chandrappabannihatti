# CAMPS · Centralized Academic Monitoring & Prediction System

A production-shaped academic monitoring workspace for **PES Institute of Technology and Management**, Shivamogga. CAMPS connects department-scoped student records, attendance, Average Academic Performance, teacher communication, announcements, remarks and an XGBoost prediction service in one responsive interface.

## What is included

- Premium university-style React/Vite frontend with React Router, Tailwind CSS, Axios, React Icons and Recharts.
- Node.js + Express REST API with JWT authentication, department-level teacher access control and role-aware endpoints.
- MySQL 8 schema covering departments, users, teachers, students, parents, attendance, subject records, Average Academic Performance values, achievements, remarks, messages, announcements, predictions and notifications.
- `.xlsx` / `.csv` upload pipeline with server-side validation, duplicate USN detection, preview/import workflow and Excel export.
- Flask Average Academic Performance service ready for a trained XGBoost `joblib` model. The API falls back to a transparent deterministic baseline when no model is mounted.
- Teacher-facing model evaluation dashboard with 80:20 holdout metrics, accuracy comparison, Pass/Fail distribution, confusion matrix, overfitting/leakage checks and viva-ready recommendations. The Python evaluator refuses to claim a production score when the source workbook has no observed target or the model artifact is missing.
- Authorized individual and bulk report-card downloads. The Node API generates blue/teal PDF report cards from the selected database record, includes subject records, remarks and achievements when present, and packages teacher-selected records as separate PDFs inside a ZIP.
- Demo data and four ready-to-use demo roles: admin, teacher, student and parent.
- The entry flow is department → role → login. The root page presents responsive department cards, then tab-style Teacher/Student/Parent/Admin selection, followed by a clean role-specific login page. Marketing hero/promotional content is not used in the sign-in flow.
- Teacher tools: a department → semester → section hierarchy. After teacher login, `/teacher/semester/:semester` lists the available sections and supports **+ Add Section**; section workspaces use `/teacher/semester/:semester/section/:section` and isolate students, attendance, Average Academic Performance, assignments, achievements, remarks, messages, announcements, analytics and predictions. Search/filter/sort, full-page student profiles at `/teacher/student/:usn`, section-scoped manual entry (`/teacher/semester/:semester/section/:section/students/new`) and Excel import (`/teacher/semester/:semester/section/:section/students/upload`) cannot mix department, semester or section records.
- Full student profiles include personal details, photo/avatar, DOB, blood group, address, parent/guardian details, academic information, achievements, certifications, skills, teacher remarks and XGBoost prediction context. Profile, Settings and Logout are available to every authenticated role.
- Teachers can add a student achievement from `/teacher/semester/:semester/section/:section/achievements`. The Student selector is built from the current section only; saved records retain department, semester, section and student ownership and are available as read-only student/parent academic records.
- Read-only student and parent dashboards with attendance, Average Academic Performance, GPA, Pass/Fail result, risk, achievements, remarks, messages and announcements.
- Admin subject management at `/admin/subjects`: the department chosen before Admin login is retained for the session, so the dashboard opens directly on Semester 1–8 cards. Selecting a semester opens scoped subject CRUD. The subject catalog is unique by `(department_code, semester, subject_code)` and the same active list is fetched by teacher, student and parent workspaces.
- Subject changes are synchronized end to end: teachers get subject-specific attendance and Average Internal Marks entry immediately at `/teacher/semester/:semester/section/:section/attendance` and `/marks`, while student/parent records show the same catalog. The API and demo fallback retain scoped subject records and validation without a second setup step.

## Run locally

Requirements: Node.js 18+, npm 9+.

```bash
npm install
cp .env.example .env
npm run dev
```

The checked-in environment template uses MySQL mode (`USE_DEMO_DATA=false`) and API-first frontend mode. For an explicit UI-only review without MySQL, set both `USE_DEMO_DATA=true` and `VITE_DEMO_MODE=true` in `.env`; demo behavior must not be used as evidence of database acceptance.

Run the full authorization, import and account-migration test suite with:

```bash
npm test
npm run test:report-cards
```

Open `http://localhost:5173`. In MySQL mode the API must be running and reachable. The client has a local review fallback only when the API is unavailable; a reachable API's authentication errors are never silently bypassed. To force local-only mode, set `VITE_DEMO_MODE=true`.

To run the REST API at the same time:

```bash
npm run server
```

The Vite proxy forwards `/api` requests to `http://localhost:5000`.

For model evaluation, install the Python dependencies in a virtual environment and run:

```bash
python -m venv .venv
. .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r ml-service/requirements.txt
npm run model:evaluate
```

The evaluator loads `ml-service/model/camps_xgboost.joblib`, uses the bundled roster workbook by default, performs an 80:20 holdout, and writes `ml-service/evaluation_report.json`. If the workbook does not contain an observed `Result` or `Outcome` column, it shows an audit-only report instead of presenting formula-derived labels as real model performance. Use `npm run model:train` only after adding a labelled dataset with both Pass and Fail outcomes.

Current bundled-workbook audit: 1,000 rows, 1,000 unique USNs, no observed `Result`/`Outcome` column, and a 0/1,000 Fail/Pass proxy distribution. Therefore the dashboard correctly reports model Accuracy, Precision, Recall, F1, and the confusion matrix as unavailable rather than claiming a misleading 100% model score; the 100% majority baseline is shown as a warning signal.

Or run both processes together:

```bash
npm run dev:full
```

### Demo accounts

The default review setup uses the same department-scoped demo credentials in both the API and the client fallback. The `Use sample account` action changes with the selected department; a teacher account is never reused outside its assigned department.

| Department | Teacher identifier | Teacher password |
| --- | --- | --- |
| CSE | `teacher@camps.edu` | `Teacher@123` |
| AIML | `aiml.teacher@camps.edu` | `Teacher@123` |
| CSDS | `csds.teacher@camps.edu` | `Teacher@123` |
| CE | `ce.teacher@camps.edu` | `Teacher@123` |
| CV | `cv.teacher@camps.edu` | `Teacher@123` |
| ME | `me.teacher@camps.edu` | `Teacher@123` |
| EEE | `eee.teacher@camps.edu` | `Teacher@123` |
| ECE | `ece.teacher@camps.edu` | `Teacher@123` |

The demo student roster contains a scoped sample USN for every configured department; initial student passwords are `Student@123`. A parent uses the linked student USN with `Parent@123`. The demo admin uses `admin@camps.edu` / `Admin@123` and inherits the department selected before login. Selecting the wrong department produces an authorization error rather than silently changing the account scope.

## MySQL setup

1. Create a MySQL user and database (MySQL 8.0+).
2. Set `USE_DEMO_DATA=false` in `.env` and configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`.
3. Inspect the configured server target before any database write:

```bash
npm run db:inspect
```

`db:inspect` is read-only. It lists databases visible to the configured MySQL user, compares `camps` and `camps_project4` when accessible, reports student/account table counts, student columns and department/semester totals, and exits without changing schema or data. Review its JSON output and set `DB_NAME` to the existing database that contains the intended records; do not guess from the project name.

4. Only after reviewing the inspection, apply the additive schema upgrade if the existing database requires it:

```bash
npm run db:init
```

The schema is in [`database/schema.sql`](database/schema.sql), with department and subject seed notes in [`database/seed.sql`](database/seed.sql). `npm run db:init` is additive: it upgrades existing profile/academic columns, reconciles a lone historical `CIVIL` department to `CV` without deleting academic rows, adds the durable student-account link and normalized-USN uniqueness checks, and refuses ambiguous duplicates for manual review. It never drops, recreates or resets the academic database. Do not run the demo seed against a populated database. `npm run db:seed` requires `ALLOW_DEMO_SEED=true` and refuses to run when core account or academic tables already contain rows. Passwords are bcrypt-hashed by the seed script.

Teacher-created and imported students receive exactly one linked `users` account with normalized USN as the login identifier and the one-time initial password `Student@123`. The account is linked by `student_id`; the optional `users.email` field is not used as the student username, so duplicate student contact emails cannot prevent account provisioning. Only the bcrypt hash is persisted. A successful manual create response contains a narrowly scoped one-time teacher confirmation (`initialCredentials`); normal student/profile/export responses never contain a password or hash. New accounts set `must_change_password`, and students change it through `POST /api/auth/change-password` after first login.

For existing profiles, run the repeatable, per-record account repair after `npm run db:init`:

```bash
USE_DEMO_DATA=false npm run db:migrate-student-accounts
```

The command checks every student row and prints `totalStudents` plus JSON counts/lists for `checked`, `created`, `skipped` and `errors`. It skips valid linked accounts, reactivates inactive accounts without replacing valid hashes, and does not overwrite a valid password. Run it again safely; already repaired accounts are skipped.

## Average Academic Performance prediction service

The prediction contract stores these six teacher-entered attributes on each student:

- `attendancePercentage` — Attendance Percentage, 0–100
- `averageInternalMarks` — Average Internal Marks, 0–100
- `averageAssignmentScore` — Average Assignment Score, 0–100
- `previousGpa` — Previous GPA, 0–10
- `currentGpa` — Current GPA, 0–10; stored and displayed, but excluded from XGBoost
- `participationScore` — Participation Score, 0–100

XGBoost receives exactly these five inputs and returns a binary result plus a separate risk label:

```json
{
  "attendancePercentage": 82,
  "averageInternalMarks": 78,
  "averageAssignmentScore": 84,
  "previousGpa": 8.1,
  "participationScore": 72
}
```

The response shape is:

```json
{
  "result": "Pass",
  "risk": "Low Risk",
  "inputs": {
    "attendancePercentage": 82,
    "averageInternalMarks": 78,
    "averageAssignmentScore": 84,
    "previousGpa": 8.1,
    "participationScore": 72
  }
}
```

Run the Flask service in a Python virtual environment:

```bash
cd ml-service
python -m venv .venv
. .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Set `ML_SERVICE_URL=http://127.0.0.1:8000` in the Node `.env`. Check `GET http://127.0.0.1:8000/health` before calling the service: it reports whether a model is loaded, a non-secret model error code, the five-input order and whether the artifact declared its feature names. To use a trained model, place a binary classifier at `ml-service/model/camps_xgboost.joblib` or set `MODEL_PATH`. The model must expose `predict_proba` and consume the five inputs in the order listed in `ml-service/app.py`; a missing or incompatible artifact is labelled `deterministic-fallback`, never `xgboost`. A mounted model that cannot return a usable Pass probability returns 503 so Node can apply the explicitly labelled fallback.

## Universal student import workflow

The dashboard and every teacher section workspace use the same `.xlsx` / `.xls` / `.csv` import contract. Download either the Excel or CSV template before selecting a file. The template headers are canonical and include `USN`, `Student Name`, `Department`, `Semester`, `Section`, `Gender`, `Email Address`, `Initial Student Login Password`, `Phone Number`, `Parent/Guardian Name`, `Parent Phone`, `Date of Birth`, `Blood Group`, `Address`, `Father/Guardian Name`, `Mother Name`, `Parent Email`, `Certifications`, `Skills`, `Attendance Percentage`, `Average Internal Marks`, `Average Assignment Score`, `Previous GPA`, `Current GPA` and `Participation Score`.

- Active rows in `departments` are the source of truth in MySQL; the unauthenticated login chooser fetches them from `GET /api/auth/departments`, while protected workspaces use `GET /api/departments`. The legacy `CIVIL`/canonical `CV` reconciliation is handled by the additive database initializer rather than by creating a second department.
- Teachers must choose an explicit semester and configured section before a dashboard import, or use the already scoped semester/section route. The backend derives the teacher department from the JWT and validates every supplied scope cell; a conflict is rejected and never relocated.
- Admins retain their existing selected-department permissions. They may choose a destination scope or allow active spreadsheet scope values when their existing access permits it. Semester values are restricted to 1–8 and sections must exist for the active department/semester. When an authorized admin imports rows for multiple sections, the response and preview report ready/imported counts per section.
- The browser retains the selected `File` object while parsing and previewing, sends that same file in `FormData` under `file` for both preview and commit, and leaves the multipart boundary to Axios. Import remains disabled until parsing/server validation completes and at least one valid row is ready. The API repeats normalization and validation in a transaction-aware commit. It reports missing fields, academic range/type errors, invalid scope, duplicate normalized USNs/emails, and row-level duplicate/database failures. Rejected rows can be downloaded as a separate report from either upload UI.
- Student accounts are created with normalized USN login identity, a bcryptjs hash of `Student@123`, `must_change_password=TRUE`, and a nullable account email. Existing valid credentials are preserved by the repeatable migration; missing/invalid links are repaired without binding duplicate contact emails to another student.

## Verification limits

The repository tests, ESLint and Vite production build are runnable in this checkout. Demo-mode API preview checks can exercise multiple departments, semesters and sections without changing the configured database. Live-MySQL migration, production database acceptance, browser automation, Flask service availability and a mounted XGBoost artifact remain environment-dependent and must be run where those services and credentials are available. Do not treat demo-mode results as proof of production database state.

## API surface

All routes except login, health, and the active login-department catalog require `Authorization: Bearer <jwt>`.

- `GET /api/auth/departments`, `POST /api/auth/login`, `POST /api/auth/change-password`, `POST /api/auth/logout` (`/api/auth/departments` is limited to active department metadata; students authenticate with department + normalized USN + password; department mismatch is rejected)
- `GET /api/departments`, `GET /api/sections?department=CSE&semester=7`, `POST /api/sections` (active database departments are the source of truth; department and section scope are authorization-checked)
- `GET /api/subjects?department=CSE&semester=7` (authenticated subject catalog for admin, teacher, student and parent scopes)
- `POST /api/subjects`, `PUT /api/subjects/:subjectId`, `DELETE /api/subjects/:subjectId` (admin-only subject CRUD with scoped validation)
- `GET /api/subjects/:subjectId/records`, `PUT /api/subjects/:subjectId/attendance`, `PUT /api/subjects/:subjectId/marks` (teacher/admin subject records and writes)
- `GET /api/students?semester=7&section=B`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id` (student creation requires an explicit valid class assignment; the API controls the `Student@123` initial credential and transactionally writes the profile plus exactly one linked `users` account)
- `POST /api/students/upload`, `GET /api/students/export` (imports use the same server-controlled initial credential, validate department/semester/section relationships, create hashed linked accounts and return per-row errors)
- `GET /api/messages`, `POST /api/messages/send`, `PUT /api/messages/:id/read`
- `GET /api/announcements`, `POST /api/announcements`, `PUT /api/announcements/:id`, `DELETE /api/announcements/:id`
- `GET /api/remarks`, `POST /api/remarks`
- `GET /api/achievements?semester=7&section=B`, `POST /api/achievements` (teacher/admin create; student and parent responses are read-only and scoped to their linked record)
- `GET /api/report-cards/student/:studentId` (authorized individual PDF report card)
- `POST /api/report-cards/bulk` with `{ "studentIds": [1, 2], "scope": { "department": "CSE", "semester": 7, "section": "B" } }` (teacher/admin ZIP download)
- `POST /api/ml/predict`
- `GET /api/ml/evaluation` (teacher/admin model evaluation report)
- `GET /api/health`

Logout clears the stored JWT/session state and redirects to the unauthenticated department chooser at `/`.

## Production notes

- Replace `JWT_SECRET` with a long random secret and keep `.env` outside source control.
- Set `CLIENT_ORIGIN` to the deployed frontend origin and use HTTPS.
- Keep `USE_DEMO_DATA=false` for application/database acceptance; use `USE_DEMO_DATA=true` only for an explicitly labelled local UI review.
- Add refresh-token rotation, rate limiting, object storage for large imports and an application logger before public deployment.
- Never use prediction risk as an automated decision; pair it with teacher context and a student conversation.
