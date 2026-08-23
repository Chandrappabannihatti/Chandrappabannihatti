# CAMS — Lovable.ai Build Pack

Centralized Academic Monitoring System (final-year CSE project).

**How to use this file**
1. Open [lovable.dev](https://lovable.dev) → New Project.
2. Paste **PROMPT 1** exactly as-is. Let it finish building.
3. Then paste **PROMPT 2 → 8**, one at a time, waiting for each build to complete.
4. Building in stages is important: one giant prompt makes Lovable skip features. Staged prompts give a far better, more complete app in less time.

---

## ⚠️ Read this before you start (stack reality check)

Lovable generates **React + Vite + Tailwind + shadcn/ui** on the frontend and uses **Supabase (PostgreSQL)** for database, auth, storage and serverless Edge Functions. It **cannot** run a Node/Express server, a MySQL database, or a Python Flask + XGBoost service inside the preview.

So the plan is:

| Your original plan | What to do in Lovable |
|---|---|
| MySQL | Supabase PostgreSQL (same SQL, same tables/keys/indexes) |
| Node.js + Express REST API | Supabase Edge Functions (Deno) exposing the **same endpoint paths** |
| JWT auth | Supabase Auth (JWT under the hood) + a `profiles` role table |
| Multer file upload | Supabase Storage buckets |
| Python Flask + XGBoost | Two options — see below |

**XGBoost options**
- **Option A (fastest, demo-safe):** Lovable builds a rule-based/weighted scoring predictor inside an Edge Function that returns the exact same JSON shape. Your UI is finished and demo-ready today.
- **Option B (real ML, for your report):** Keep your Flask + XGBoost API, host it free on Render/Railway, and point the Edge Function at it via the `ML_API_URL` secret. **PROMPT 7** below sets this up so you can flip from A to B without touching the frontend.

This is the honest, fastest route. If your guide insists on MySQL + Express, export the Lovable frontend from GitHub and swap the API layer later — the endpoint paths stay identical, so only the base URL changes.

---

# PROMPT 1 — Foundation, design system, auth & role routing

```
Build a production-ready full-stack web application called Centralized Academic Monitoring System (CAMS). It is a college ERP + academic monitoring platform for a final-year Computer Science Engineering project. It must look premium, modern and university-grade, and be fully responsive on mobile, tablet and desktop.

STACK
React + Vite + TypeScript, React Router, Tailwind CSS, shadcn/ui, lucide-react icons, Recharts for charts, TanStack Query for data fetching. Use Supabase for PostgreSQL database, authentication, storage and Edge Functions.

DESIGN SYSTEM (very important — define this first)
- Premium university style. Deep navy sidebar (#0F172A to #1E293B gradient) with white/slate-300 text and an indigo active-item highlight.
- Light slate-50 page background, pure white cards with soft shadows and rounded-2xl corners.
- Primary color indigo-600, accent emerald-500 for success/pass, amber-500 for warning/medium risk, rose-500 for danger/fail/high risk.
- Typography: Inter font, bold tracking-tight headings, clear hierarchy.
- All colors, gradients, shadows and radii must be HSL semantic tokens in index.css and tailwind.config.ts. Never hardcode colors in components.
- Smooth fade-in and slide-up animations on page load, hover lift on cards, skeleton loaders while data loads, toast notifications for every action.
- Reusable components: StatCard, PageHeader, DataTable (with search + sort + pagination + empty state), FormDialog, ConfirmDialog, RiskBadge, EmptyState, SectionCard.

APP FLOW
Landing Page → Department Selection → Role Selection → Login (Teacher / Student / Parent) → Role-specific Dashboard.

1) LANDING PAGE
Full-height hero with an animated navy-to-indigo gradient background and subtle grid pattern. Big headline "Centralized Academic Monitoring System", subheadline about tracking attendance, marks, achievements and AI-powered performance prediction. Primary CTA "Get Started" → /departments. Below the hero: a 4-card feature strip (AI Performance Prediction, Real-time Academic Monitoring, Parent Portal, Achievement & Placement Tracking) and a stats band (Students Tracked, Departments, Prediction Accuracy, Announcements Sent). Sticky transparent-to-solid navbar on scroll.

2) DEPARTMENT SELECTION PAGE (/departments)
Responsive grid of 8 large clickable department cards, each with an icon, code, full name and a hover lift + colored glow:
CSE - Computer Science Engineering (monitor icon)
AIML - Artificial Intelligence & Machine Learning (brain/cpu icon)
CSDS - Computer Science & Data Science (bar-chart icon)
CE - Civil Engineering (hard-hat icon)
CV - Civil & Environmental (bridge/landmark icon)
ME - Mechanical Engineering (cog icon)
EEE - Electrical & Electronics Engineering (zap icon)
ECE - Electronics & Communication Engineering (radio icon)
Store the selected department in context + localStorage and show it as a badge on every following page, with a "Change" link.

3) ROLE SELECTION PAGE (/role)
Three big cards — Teacher, Student, Parent — each with an icon, a one-line description of what that role can do, and a "Continue" button routing to the matching login page.

4) AUTHENTICATION
Use Supabase Auth with email/password. Create a profiles table linked to auth.users holding: id, role ('teacher' | 'student' | 'parent'), full_name, department, linked_usn.
- Teacher login: Email + Password.
- Student login: USN + Password (map the USN to an internal email like <usn>@cams.local behind the scenes so Supabase Auth works, but the student only ever types the USN).
- Parent login: Student USN + Parent Password (map to parent.<usn>@cams.local behind the scenes).
Split-screen login pages: left is a navy gradient panel with the CAMS logo and a rotating quote, right is a clean card form with inline validation, show/hide password, loading state and friendly error toasts.
Implement protected routes with a role guard: a teacher URL opened by a student redirects to the student dashboard. Enable Row Level Security on every table so students see only their own row and parents see only their child's row. Never store roles on the client for authorization — always read them from the profiles table.
Include a "Load Demo Data" button on the login screens that seeds and logs into a demo teacher account, so the app is instantly demo-able during project review.

5) LAYOUT
Persistent navy sidebar (collapsible, turning into a sheet drawer on mobile) with the CAMS logo, the user's avatar, name, role and department, and nav items with icons: Dashboard, Students, Add Student, Prediction, Achievements, Certifications, Internships, Remarks, Messages, Announcements, Reports, Logout. Students and parents see a reduced menu. Top bar has a page title, a global search, a notification bell with an unread count badge, and a profile dropdown.

Set up the full database schema and RLS in this first step, all pages routed, and placeholder dashboards. Make it beautiful and complete before adding features.
```

---

# PROMPT 2 — Database schema

```
Create the complete PostgreSQL schema in Supabase with proper primary keys, foreign keys, indexes, timestamps, check constraints and Row Level Security policies. Add updated_at triggers on all tables.

departments: id, code (unique), name, icon, created_at
teachers: id (uuid, FK auth.users), employee_id (unique), name, email (unique), phone, designation, department, photo_url, created_at
students: id (uuid), usn (unique, indexed), name, photo_url, gender, dob, blood_group, email, phone, address, department (indexed), semester (1-8, indexed), section, father_name, mother_name, parent_name, parent_phone, parent_email, parent_occupation, emergency_contact, attendance (numeric), internal_marks (numeric), assignment_score (numeric), previous_gpa (numeric), current_gpa (numeric), participation_score (numeric), prediction_result, risk_level, placement_score, created_at, updated_at
parents: id (uuid, FK auth.users), student_usn (FK students.usn), name, phone, email, occupation, created_at
achievements: id, student_usn (FK), title, type (Sports | Hackathon | Workshop | Certification | Internship | Research Paper | Cultural Event | Technical Event | NSS | NCC), description, achievement_date, certificate_url, added_by, created_at
certifications: id, student_usn (FK), platform (NPTEL | Coursera | Udemy | Infosys Springboard | AWS | Azure | Google Cloud | Other), course_name, issue_date, credential_id, certificate_url, created_at
internships: id, student_usn (FK), company_name, role, start_date, end_date, duration_months, description, certificate_url, created_at
remarks: id, student_usn (FK), teacher_id (FK), remark, category (Excellent Performance | Good Participation | Needs Improvement | Low Attendance Alert | Outstanding Achievement), created_at
messages: id, sender_id, sender_role, receiver_id, receiver_usn, receiver_role ('student' | 'parent'), message_title, message_content, status ('unread' | 'read'), created_at
announcements: id, scope ('college' | 'department' | 'semester'), department, semester, title, message, created_by, created_at, updated_at
predictions: id, student_usn (FK), attendance, internal_marks, assignment_score, previous_gpa, participation, prediction, confidence, risk_level, recommendations (jsonb), created_at

Create Supabase Storage buckets: student-photos (public), certificates (private), documents (private) with correct access policies.

Seed realistic demo data: 8 departments, 4 teachers, 60 students spread across CSE/AIML/ECE and semesters 3/5/7 with Indian names and realistic USNs like 4PM23CS101, varied attendance 55-98%, marks and GPAs, plus 30 achievements, 20 certifications, 12 internships, 15 remarks, 20 messages and 8 announcements. The app must look full and alive on first load.
```

---

# PROMPT 3 — Teacher dashboard & analytics

```
Build the Teacher Dashboard at /teacher/dashboard. The teacher only ever sees students of their own department — enforce this in the queries and in RLS.

TOP STAT CARDS (animated count-up, icon in a tinted circle, small trend text):
Total Students, Pass Students, Fail Students, Pass Percentage, Total Achievements, Students At Risk.

TOP PERFORMER CARD: photo, name, USN, current GPA, attendance and department rank, on an indigo gradient background with a trophy icon.

CHARTS (Recharts, in white rounded cards with titles and legends, fully responsive):
1. Attendance Analytics — bar chart of average attendance by semester.
2. Pass vs Fail — donut chart with a percentage in the center.
3. GPA Distribution — histogram across bands (<6, 6-7, 7-8, 8-9, 9-10).
4. Internal Marks Analysis — line/area chart of average internal marks by section.
5. Student Risk Analysis — stacked bar of Low / Medium / High risk per semester.
6. Performance Timeline — line chart of average GPA across semesters 1-8.

BELOW THE CHARTS:
- "Students At Risk" table: photo, name, USN, attendance, GPA, risk badge, and a quick "Send Message" action.
- "Recent Announcements" feed and "Recent Remarks" feed side by side.
- "Achievement Leaderboard": top 5 students ranked by a composite of GPA, attendance and achievement count, with gold/silver/bronze medals.

RISK CLASSIFICATION RULE (use everywhere in the app):
score = (attendance * 0.3) + (internal_marks/25 * 100 * 0.25) + (current_gpa/10 * 100 * 0.3) + (assignment_score/20 * 100 * 0.15)
score >= 75 → Low Risk (green), 50-74 → Medium Risk (amber), < 50 → High Risk (red).
Show it as a RiskBadge component with a colored dot everywhere a student appears.

Add date-range and semester filters at the top of the dashboard that update every chart.
```

---

# PROMPT 4 — Student management + Excel import/export

```
Build the Student Management module for teachers.

/teacher/students — a professional data table with: photo avatar, USN, name, semester, section, attendance with a mini progress bar, current GPA, risk badge, prediction result badge, and a row actions menu (View, Edit, Delete, Send Message, Add Remark).
Features: debounced search by name/USN, filters for semester + section + risk level + pass/fail, sortable columns, pagination with page-size selector, row selection with bulk delete, sticky header, card layout fallback on mobile, skeleton loading state and a nice empty state.

/teacher/students/add and edit — a multi-step form in tabs: Personal Details, Parent Details, Academic Details. Photo upload with live preview to Supabase Storage. Full zod validation with helpful inline errors, unsaved-changes warning, and a success toast on save.

/teacher/students/:usn — a full student profile page: header banner with photo, name, USN, department/semester/section, risk badge and quick actions. Then tabbed sections: Overview (academic stat cards + a radar chart of attendance/marks/assignments/GPA/participation), Achievements, Certifications, Internships, Remarks, Messages, Prediction History, Documents.

EXCEL IMPORT / EXPORT using the xlsx library:
- Import: drag-and-drop .xlsx upload, parse client-side, show a preview table with per-row validation, highlight bad rows, then bulk-insert valid rows and report "X imported, Y skipped". Include a "Download Template" button that generates a correctly-formatted sample file.
- Export: download the current filtered student list as a styled .xlsx with all columns and a timestamped filename.
Also add PDF-style printable report export for a single student profile.
```

---

# PROMPT 5 — Communication: messages, remarks, announcements, notifications

```
Build the complete Communication & Announcement Module.

A) INDIVIDUAL STUDENT MESSAGING (/teacher/messages)
Two-pane layout. Left: compose panel with a searchable student picker (shows photo, name, USN), a Recipient toggle for "Student" / "Parent" / "Both", a message title, a message body textarea with a character counter, and quick-template chips ("Attendance below 75% — please meet the class mentor", "Excellent performance — keep it up", "Assignment pending submission", "Parent meeting requested"). Right: Sent Messages history with search, recipient filter, read/unread status badges, timestamps, and expandable message cards.

B) PARENT MESSAGING
When "Parent" is selected, automatically fetch and display the parent's name, phone and email from the student record — the teacher never has to look it up. Send to the parent's account and label the thread "Parent of <USN>".

C) TEACHER REMARKS (/teacher/remarks)
Add a remark with a student picker, a category select (Excellent Performance, Good Participation, Needs Improvement, Low Attendance Alert, Outstanding Achievement), and free-text. Category-colored remark cards in a timeline view, with edit and delete. Remarks are visible in both the Student Portal and the Parent Portal.

D) ANNOUNCEMENT SYSTEM (/teacher/announcements)
Create announcements with a scope selector:
- College — visible to all students and parents.
- Department — a department select; only that department's students and parents see it.
- Semester — department + semester; only that department/semester's students and parents see it.
Fields: title, message, scope, department, semester, optional priority (Normal / Important / Urgent) and optional expiry date. Full CRUD: create, view, edit, delete with a confirm dialog. Display as a card feed with a scope badge, an audience-reach count ("Reaching 42 students, 42 parents"), and filter tabs by scope. Enforce the scope filtering in RLS, not just the UI.

E) NOTIFICATION CENTER
Bell icon in the top bar with a live unread count. Dropdown grouped into Messages, Teacher Remarks and Announcements, with a "Mark all as read" action and click-through to the item. Student and Parent dashboards get a Notifications section with the same three groups. Use Supabase realtime so new messages and announcements appear instantly without a refresh.

API SURFACE (implement as Supabase Edge Functions with these exact route paths, so the project report matches the code):
POST /api/messages/send, GET /api/messages/student/:usn, GET /api/messages/parent/:usn, GET /api/messages/teacher/:id
POST /api/announcements, GET /api/announcements, PUT /api/announcements/:id, DELETE /api/announcements/:id
POST /api/remarks, GET /api/remarks/:usn
```

---

# PROMPT 6 — Achievements, certifications, internships, placement readiness

```
Build the Achievement & Career modules.

ACHIEVEMENT MANAGEMENT (/teacher/achievements)
Full CRUD. Fields: student, title, type (Sports, Hackathon, Workshop, Certification, Internship, Research Paper, Cultural Event, Technical Event, NSS, NCC), description, date, certificate file upload. Display as a filterable card grid with type-colored badges, a type filter, a student filter, and a certificate preview/download. Add a small "Achievements by Type" pie chart at the top.

CERTIFICATION TRACKER (/teacher/certifications)
Platforms: NPTEL, Coursera, Udemy, Infosys Springboard, AWS, Azure, Google Cloud, Other. Fields: course name, platform, issue date, credential ID, certificate upload. Show platform logos/colored badges in a table, with student and platform filters.

INTERNSHIP TRACKER (/teacher/internships)
Fields: company name, role, start date, end date, auto-computed duration, description, certificate upload. Timeline-style cards per student.

PLACEMENT READINESS SCORE (final-year students, semesters 7 and 8)
placement_score = (current_gpa/10 * 40) + (attendance * 0.20) + (min(certifications,5)/5 * 20) + (min(internships,2)/2 * 10) + (min(achievements,5)/5 * 10)
Show it as a large animated radial progress gauge with a label: 80+ "Placement Ready", 60-79 "Almost Ready", below 60 "Needs Work". Add a breakdown bar list of each contributing factor and auto-generated improvement tips such as "Add 2 more certifications to gain 8 points".

STUDENT PORTFOLIO PAGE (/portfolio/:usn — shareable, clean, print-friendly)
Photo, name, USN, department, GPA, skills, projects, achievements, certifications, internships and placement readiness, laid out like a professional resume with a "Download PDF" button.
```

---

# PROMPT 7 — Prediction engine (XGBoost-ready)

```
Build the XGBoost Student Performance Prediction module.

/teacher/prediction — a two-column page. Left: a prediction form with sliders and number inputs for attendance (0-100), internal_marks (0-25), assignment_score (0-20), previous_gpa (0-10) and participation (0-5), plus a "Load from Student" picker that fills the form from an existing student record. Right: a result panel showing a large Pass/Fail badge, a confidence percentage as a radial gauge, the risk level, a feature-contribution horizontal bar chart showing which inputs helped or hurt, and auto-generated smart recommendations ("Increase attendance to at least 75%", "Improve internal marks", "Submit assignments regularly", "Participate more in class activities").
Add a "Predict for All Students" bulk action that runs the model over the whole department, saves the results to the students and predictions tables, and shows a summary with a pass/fail donut.
Keep a Prediction History table per student with a trend line of confidence over time.

IMPLEMENTATION
Create a Supabase Edge Function at POST /api/predict that accepts:
{ "attendance": 85, "internal_marks": 22, "assignment_score": 18, "previous_gpa": 8.5, "participation": 4 }
and returns:
{ "prediction": "Pass", "confidence": 0.91, "risk_level": "Low Risk", "recommendations": ["..."] }

The function must first check for an ML_API_URL secret. If it is set, forward the request to that external Python Flask + XGBoost API and return its response. If it is not set, fall back to a built-in weighted scoring model that produces the identical JSON shape, so the app always works offline and during the demo.
Add a settings field where I can paste my deployed Flask API URL later, and show a small badge on the prediction page reading "Model: XGBoost API" or "Model: Built-in" depending on which path is active.
```

---

# PROMPT 8 — Student portal & Parent portal

```
Build the Student Portal and the Parent Portal. Both are strictly read-only and must only ever show that one student's data, enforced by Row Level Security.

STUDENT PORTAL (/student/dashboard)
Welcome header with photo, name, USN, department, semester, section and risk badge.
Stat cards: Attendance, Internal Marks, Assignment Score, Current GPA, Prediction Result, Placement Readiness (final year only).
An amber Attendance Alert banner when attendance is below 75%, reading "Attendance Warning — Current Attendance: 68%. Please meet your class mentor."
Charts: GPA timeline across semesters, and a radar chart of the student's performance factors versus the class average.
Sections: Teacher Remarks (category-colored timeline), Messages inbox with unread badges and a read-receipt on open, Recent Announcements filtered to the student's department and semester, Achievements, Certifications, Internships, and Smart Recommendations generated from the prediction model.

PARENT PORTAL (/parent/dashboard)
Header reading "Parent Portal — <Student Name> (<USN>)".
The same academic stat cards and charts, presented in simple, parent-friendly language with short explanations under each metric.
The same attendance alert banner.
Sections: Teacher Remarks, Messages from Teachers with unread badges, Announcements, Achievements, and a plain-language performance summary paragraph such as "Your child is performing well in internals but attendance needs attention."
Add a "Request Meeting with Teacher" button that creates a message to the class teacher with a preferred date and reason.

Both portals must be mobile-first — most parents will open this on a phone. Use large touch targets, a bottom tab bar on mobile, and no horizontal scrolling anywhere.
```

---

## Optional follow-up prompts (add these if you have time left)

```
Add an Academic Calendar page where teachers post Exam Dates, Project Reviews, Seminars and Placement Drives, shown as a month calendar plus an upcoming-events list on every dashboard.
```
```
Add Mentor Allocation: a teacher can be assigned up to 20 students, with a "My Mentees" filtered view on the teacher dashboard.
```
```
Add automatic Student Ranking: compute department rank and college rank from GPA, attendance and achievement count, and show the rank on every student profile and on the student portal.
```
```
Add an HOD role with a Department Comparison Dashboard comparing pass rate, average GPA, average attendance and at-risk counts across CSE, AIML, ECE, EEE and the other departments.
```
```
Add a Documents module where students upload Aadhaar, SSLC marks card, PU marks card, certificates and resume to private Supabase Storage, with upload, preview and download.
```
```
Add an AI Academic Assistant chat widget that answers questions like "How can I improve my GPA?", "What is my attendance percentage?" and "What certifications should I take?" using the logged-in student's real data.
```
```
Add a Project Repository where students submit Project Title, GitHub Link and Description, and teachers can review and mark them Approved or Needs Changes.
```

---

## Demo-day checklist

- [ ] Demo teacher, student and parent accounts seeded with data
- [ ] Every chart populated (no empty states in the demo path)
- [ ] Attendance-alert banner visible on at least one student
- [ ] One High Risk student ready to show the risk classification
- [ ] One announcement of each scope (college / department / semester)
- [ ] Excel import and export both tested with the template file
- [ ] Prediction run live for one student
- [ ] Whole flow checked on a phone screen
