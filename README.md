# CAMPS · Centralized Academic Monitoring & Prediction System

A production-shaped academic monitoring workspace for **PES Institute of Technology and Management**, Shivamogga. CAMPS connects department-scoped student records, attendance, internal marks, teacher communication, announcements, remarks and a prediction service in one responsive interface.

## What is included

- Premium university-style React/Vite frontend with React Router, Tailwind CSS, Axios, React Icons and Recharts.
- Node.js + Express REST API with JWT authentication, department-level teacher access control and role-aware endpoints.
- MySQL 8 schema covering departments, users, teachers, students, parents, attendance, internal marks, assignments, remarks, messages, announcements, predictions and notifications.
- `.xlsx` / `.csv` upload pipeline with server-side validation, duplicate USN detection, preview/import workflow and Excel export.
- Flask prediction service ready for a trained XGBoost `joblib` model. The API falls back to a transparent deterministic baseline when no model is mounted.
- Demo data and four ready-to-use demo roles: admin, teacher, student and parent.
- Teacher tools: a dedicated semester selection page followed by isolated semester routes (`/teacher/semester/1` through `/teacher/semester/8`), each with its own roster, attendance, marks, analytics, messages, announcements and prediction desk. Search/filter/sort, manual student entry, upload/import and shared remarks are scoped to that semester.
- Read-only student and parent dashboards with attendance, marks, CGPA, prediction, remarks, messages and announcements.

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

A teacher is scoped to CSE in the demo. Teacher sign-in opens `/teacher/semesters`; choosing a semester opens its isolated route, such as `/teacher/semester/5`. The student and parent accounts open the read-only record for Ishita Kulkarni.

## MySQL setup

1. Create a MySQL user and database (MySQL 8.0+).
2. Set `USE_DEMO_DATA=false` in `.env` and configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`.
3. Create the schema and seed the demo records:

```bash
npm run db:init
npm run db:seed
```

The schema is in [`database/schema.sql`](database/schema.sql), with department seed notes in [`database/seed.sql`](database/seed.sql). Passwords are bcrypt-hashed by the seed script.

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
- `GET /api/students`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id`
- `POST /api/students/upload`, `GET /api/students/export`
- `GET /api/messages`, `POST /api/messages/send`, `PUT /api/messages/:id/read`
- `GET /api/announcements`, `POST /api/announcements`, `PUT /api/announcements/:id`, `DELETE /api/announcements/:id`
- `GET /api/remarks`, `POST /api/remarks`
- `POST /api/ml/predict`
- `GET /api/health`

## Production notes

- Replace `JWT_SECRET` with a long random secret and keep `.env` outside source control.
- Set `CLIENT_ORIGIN` to the deployed frontend origin and use HTTPS.
- Set `USE_DEMO_DATA=false` only after MySQL is reachable and the schema has been initialized.
- Add refresh-token rotation, rate limiting, object storage for large imports and an application logger before public deployment.
- Never use prediction risk as an automated decision; pair it with teacher context and a student conversation.
