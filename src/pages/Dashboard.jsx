import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  FiActivity,
  FiAlertCircle,
  FiAward,
  FiBarChart2,
  FiArrowRight,
  FiBell,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiDownload,
  FiEdit3,
  FiEye,
  FiFileText,
  FiFilter,
  FiGrid,
  FiHeart,
  FiHome,
  FiInfo,
  FiLogOut,
  FiMail,
  FiMenu,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiSettings,
  FiShield,
  FiSliders,
  FiTrash2,
  FiTrendingUp,
  FiUploadCloud,
  FiUser,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import {
  attendanceTrend,
  cloneDemoStudents,
  departments,
  currentUser,
  demoAchievements,
  demoAnnouncements,
  demoRemarks,
  demoStudents,
  demoTeachers,
  getDemoMessages,
  getDemoSubjects,
  markDemoMessageRead,
  upsertDemoMessage,
  semesters,
  studentUser,
  subjectPerformance,
} from '../data/demo'
import { Brand } from './Landing'
import BackButton from '../components/BackButton'
import ChatView from '../components/ChatView'
import ReportCardDownloadButton from '../components/ReportCardDownloadButton'
import ModelEvaluation from './ModelEvaluation'
import api, { DEMO_MODE, getAuthToken, isApiToken, setAuthToken } from '../lib/api'
import { ACADEMIC_ATTRIBUTES, PREDICTION_INPUTS, academicFields, predictAcademic, predictionFields } from '../lib/academic'
import { hashLocalCredential } from '../lib/localCredentials'
import { importStatusLabel, importSummary, normalizeImportRows } from '../lib/studentImport'

const navItems = [
  { key: 'overview', label: 'Overview', icon: FiGrid },
  { key: 'students', label: 'Student records', icon: FiUsers },
  { key: 'prediction', label: 'Prediction desk', icon: FiActivity },
  { key: 'evaluation', label: 'Model evaluation', icon: FiBarChart2 },
  { key: 'messages', label: 'Messages', icon: FiMessageCircle, badge: 3 },
  { key: 'announcements', label: 'Announcements', icon: FiBell },
  { key: 'remarks', label: 'Teacher remarks', icon: FiEdit3 },
]

const adminNavItems = [
  { key: 'overview', label: 'Overview', icon: FiGrid },
  { key: 'people', label: 'People management', icon: FiUsers },
  { key: 'subjects', label: 'Subject management', icon: FiBookOpen },
  { key: 'students', label: 'Student records', icon: FiUsers },
  { key: 'reports', label: 'Academic reports', icon: FiFileText },
  { key: 'evaluation', label: 'Model evaluation', icon: FiBarChart2 },
  { key: 'prediction', label: 'Prediction desk', icon: FiZap },
  { key: 'settings', label: 'Administration settings', icon: FiSettings },
]

const learnerNavItems = [
  { key: 'overview', label: 'My overview', icon: FiGrid },
  { key: 'records', label: 'Academic records', icon: FiBookOpen },
  { key: 'achievements', label: 'Achievements', icon: FiAward },
  { key: 'messages', label: 'Messages', icon: FiMessageCircle, badge: 1 },
  { key: 'announcements', label: 'Announcements', icon: FiBell },
]

const pieColors = ['#5BAA87', '#C89A44', '#C56D68']

function riskKey(risk) { return String(risk || 'Low Risk').toLowerCase().replace(/\s+risk$/, '') }
function riskLabel(risk) { const value = String(risk || 'Low Risk'); return /\srisk$/i.test(value) ? value : `${value} Risk` }
const semesterOrdinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

function RiskBadge({ risk }) {
  const label = riskLabel(risk)
  return <span className={`risk-badge risk-${riskKey(label)}`}>{label}</span>
}

function LearnerSubjectCatalog({ subjects = [], student }) {
  const scope = student ? `${student.department} · Semester ${student.semester}` : 'Your academic scope'
  return <section className="content-card subject-catalog-card learner-subject-catalog"><div className="card-heading"><div><h2 className="card-title">Your subjects</h2><p className="card-description">{scope} · curriculum synchronized by administration</p></div><span className="scope-pill"><FiBookOpen /> {subjects.length} active</span></div>{subjects.length ? <div className="subject-catalog-grid">{subjects.map((subject) => <div className="subject-catalog-item" key={subject.subjectId || subject.id}><span>{subject.subjectCode}</span><strong>{subject.subjectName}</strong><small>{subject.credits} credits · Attendance &amp; marks</small></div>)}</div> : <div className="empty-state subject-empty-state"><FiBookOpen /><span>No subjects have been published for this semester yet.</span></div>}</section>
}

function Avatar({ initials, tone = '' }) {
  return <span className={`avatar ${tone}`}>{initials}</span>
}

function Layout({ user, activeView, onNavigate, onLogout, showBack, unreadCount = 0, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const learner = user.role === 'student' || user.role === 'parent'
  const items = learner ? learnerNavItems : user.role === 'admin' ? adminNavItems : navItems
  const workspaceLabel = user.role === 'admin' ? 'Administration' : user.role === 'teacher' ? `${user.department} department` : `${user.department} · Semester ${user.semester}`

  const navigate = (key) => {
    onNavigate(key)
    setSidebarOpen(false)
  }

  return (
    <div className="dashboard-layout">
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Brand light />
        <button className="sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><FiX /></button>
        <p className="sidebar-section-label">Workspace</p>
        <div className="sidebar-nav">
          {items.map(({ key, label, icon: Icon, badge }) => <button key={key} type="button" className={activeView === key ? 'active' : ''} onClick={() => navigate(key)}><Icon /><span>{label}</span>{key === 'messages' && unreadCount > 0 ? <span className="sidebar-badge">{unreadCount}</span> : key !== 'messages' && badge ? <span className="sidebar-badge">{badge}</span> : null}</button>)}
        </div>
        <p className="sidebar-section-label">Account</p>
        <div className="sidebar-nav"><button type="button" onClick={() => navigate('profile')} className={activeView === 'profile' ? 'active' : ''}><FiUser /><span>Profile</span></button><button type="button" onClick={() => navigate('settings')} className={activeView === 'settings' ? 'active' : ''}><FiSettings /><span>Settings</span></button></div>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><strong><FiHeart style={{ verticalAlign: 'middle', marginRight: 5 }} /> Human-first insight</strong><p>Every alert is a starting point for a better conversation.</p></div>
          <div className="sidebar-profile"><Avatar initials={user.initials || 'CA'} tone={learner ? 'mint' : ''} /><div className="profile-meta"><strong>{user.name}</strong><span>{workspaceLabel}</span></div><button className="logout-btn" type="button" onClick={onLogout} aria-label="Sign out"><FiLogOut /></button></div>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-topbar"><div className="dashboard-topbar-leading"><div className="breadcrumb"><button className="mobile-sidebar-trigger" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><FiMenu /></button><span>CAMPS</span><FiChevronRight /><strong>{items.find((item) => item.key === activeView)?.label || 'Workspace'}</strong></div></div><div className="topbar-actions"><button className="topbar-icon" type="button" aria-label="Help"><FiShield /></button><button className="topbar-icon" type="button" aria-label="Notifications"><FiBell />{unreadCount > 0 && <i className="notification-dot" />}</button><span className="topbar-divider" /><div className="topbar-user"><Avatar initials={user.initials || 'CA'} tone={learner ? 'mint' : ''} /><div className="topbar-user-meta"><strong>{user.name}</strong><span>{workspaceLabel}</span></div></div></div></header>
        {showBack && <div className="dashboard-page-back"><BackButton fallbackPath="/app" minHistoryIndex={2} /></div>}
        {children}
      </main>
    </div>
  )
}

function PageIntro({ eyebrow, title, description, actions }) {
  return <div className="page-intro"><div><p className="page-eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{description && <p className="page-subtitle">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

function DashboardDataState({ title, message, loading = false, onRetry }) {
  return <div className="dashboard-content"><section className="content-card dashboard-data-state"><div className="dashboard-data-state-icon">{loading ? <FiActivity className="dashboard-loading-icon" /> : <FiAlertCircle />}</div><h1>{loading ? 'Loading your dashboard…' : title}</h1><p>{message}</p>{!loading && onRetry && <button className="button-primary" type="button" onClick={onRetry}><FiRefreshCw /> Try again</button>}</section></div>
}

function DashboardDataNotice({ message, onRetry }) {
  if (!message) return null
  return <div className="dashboard-data-notice" role="status"><FiAlertCircle /><span>{message}</span>{onRetry && <button type="button" onClick={onRetry}>Retry</button>}</div>
}

function Overview({ user, students, subjects = [], onNavigate, onAddStudent, onUpload, onExport, adminSummary, adminSummaryError, onRetrySummary }) {
  const isAdmin = user.role === 'admin'
  const departmentScope = user.department === 'ALL' ? '' : user.department
  const [selectedSemester, setSelectedSemester] = useState(7)
  const department = departmentScope || (isAdmin ? 'All departments' : user.department)
  const scopeStudents = useMemo(() => departmentScope ? students.filter((student) => student.department === departmentScope) : students, [departmentScope, students])
  const semesterStudents = scopeStudents.filter((student) => Number(student.semester) === Number(selectedSemester))
  const summaryRows = Array.isArray(adminSummary?.semesters) ? adminSummary.semesters : []
  const semesterCounts = semesters.map((semester) => {
    const summaryRow = summaryRows.find((row) => Number(row.semester) === Number(semester))
    return { semester, count: summaryRow ? Number(summaryRow.studentCount || 0) : (isAdmin && !DEMO_MODE ? null : scopeStudents.filter((student) => Number(student.semester) === Number(semester)).length) }
  })
  const totalFrom = (value, fallback) => value === null || value === undefined ? fallback : Number(value)
  const total = adminSummary?.counts?.totalStudents == null ? (isAdmin && !DEMO_MODE ? '—' : scopeStudents.length) : Number(adminSummary.counts.totalStudents)
  const averageFor = (rows, key, decimals = 1) => {
    const values = rows.map((student) => Number(student[key])).filter((value) => Number.isFinite(value))
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(decimals) : '—'
  }
  const summaryAverage = (key, fallbackKey) => adminSummary?.academic?.[key] === null || adminSummary?.academic?.[key] === undefined
    ? averageFor(scopeStudents, fallbackKey)
    : Number(adminSummary.academic[key]).toFixed(1)
  const avgAttendance = summaryAverage('averageAttendance', 'attendancePercentage')
  const avgCurrentGpa = summaryAverage('averageCurrentGpa', 'currentGpa')
  const semesterAttendance = semesters.map((semester) => {
    const summaryRow = summaryRows.find((row) => Number(row.semester) === Number(semester))
    if (summaryRow) return { semester: `Sem ${semester}`, attendance: summaryRow.averageAttendance == null ? null : Number(summaryRow.averageAttendance), students: Number(summaryRow.studentCount || 0) }
    const rows = scopeStudents.filter((student) => Number(student.semester) === Number(semester))
    const average = averageFor(rows, 'attendancePercentage')
    return { semester: `Sem ${semester}`, attendance: average === '—' ? null : Number(average), students: rows.length }
  })
  const atRisk = totalFrom(adminSummary?.academic?.atRisk, scopeStudents.filter((student) => student.risk === 'High Risk' || student.risk === 'Medium Risk').length)
  const totalTeachers = adminSummary?.counts?.totalTeachers == null ? (DEMO_MODE ? demoTeachers.filter((teacher) => !departmentScope || teacher.department === departmentScope).length : '—') : Number(adminSummary.counts.totalTeachers)
  const totalParents = adminSummary?.counts?.totalParents == null ? (DEMO_MODE ? scopeStudents.filter((student) => student.parentName).length : '—') : Number(adminSummary.counts.totalParents)
  const totalConfiguredSubjects = adminSummary?.counts?.totalConfiguredSubjects == null ? (DEMO_MODE || subjects.length ? subjects.filter((subject) => subject.isActive !== false && (!departmentScope || subject.department === departmentScope)).length : '—') : Number(adminSummary.counts.totalConfiguredSubjects)
  const totalSemesters = totalFrom(adminSummary?.counts?.totalSemesters, semesters.length)
  const academic = adminSummary?.academic || {}
  const academicMetric = (key, fallbackKey, suffix = '') => {
    const value = academic[key] === null || academic[key] === undefined ? averageFor(scopeStudents, fallbackKey) : Number(academic[key]).toFixed(1)
    return value === '—' ? value : `${value}${suffix}`
  }
  const localSemesterRows = semesters.map((semester) => {
    const rows = scopeStudents.filter((student) => Number(student.semester) === Number(semester))
    return { semester, studentCount: rows.length, subjectCount: subjects.filter((subject) => subject.isActive !== false && (!departmentScope || subject.department === departmentScope) && Number(subject.semester) === Number(semester)).length, averageAttendance: averageFor(rows, 'attendancePercentage'), averageInternalMarks: averageFor(rows, 'averageInternalMarks'), averageAssignmentScore: averageFor(rows, 'averageAssignmentScore'), averagePreviousGpa: averageFor(rows, 'previousGpa'), averageParticipationScore: averageFor(rows, 'participationScore') }
  })
  const academicSemesterRows = summaryRows.length ? summaryRows : localSemesterRows
  const modelStatus = adminSummary?.model
    ? adminSummary.model.metricsAvailable ? 'Evaluation available' : adminSummary.model.status === 'audit_only' ? 'Audit only' : 'Evaluation unavailable'
    : 'Open evaluation page'
  const modelDetail = adminSummary?.model?.datasetRows ? `${adminSummary.model.datasetRows} dataset records · ${adminSummary.model.modelLoaded ? 'model loaded' : 'model artifact unavailable'}` : adminSummary?.model?.warning || 'The evaluation report status is not loaded in this dashboard.'
  const riskData = [
    { name: 'Low Risk', value: totalFrom(adminSummary?.riskDistribution?.['Low Risk'], scopeStudents.filter((student) => student.risk === 'Low Risk').length) },
    { name: 'Medium Risk', value: totalFrom(adminSummary?.riskDistribution?.['Medium Risk'], scopeStudents.filter((student) => student.risk === 'Medium Risk').length) },
    { name: 'High Risk', value: totalFrom(adminSummary?.riskDistribution?.['High Risk'], scopeStudents.filter((student) => student.risk === 'High Risk').length) },
  ]
  const alerts = scopeStudents.filter((student) => student.risk === 'High Risk' || student.attendancePercentage < 76).slice(0, 3)
  const currentDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const firstName = String(user.name || '').trim().split(/\s+/)[0] || 'there'

  return <div className="dashboard-content">
    <PageIntro eyebrow={`${department} · Academic year 2026–27`} title={`Good morning, ${firstName}.`} description={`${currentDate}  ·  Here is what needs your attention today.`} actions={<><button type="button" className="button-ghost" onClick={onExport}><FiDownload /> Export report</button><button type="button" className="button-primary" onClick={onAddStudent}><FiPlus /> Add student</button>{isAdmin && <button type="button" className="button-ghost" onClick={() => onNavigate('people')}><FiUsers /> Manage people</button>}</>} />
    <section className="semester-picker-card">
      <div className="semester-picker-head"><div><p className="page-eyebrow">{isAdmin ? 'Administration workspace' : 'Teacher workspace'}</p><h2>Choose a semester</h2><p>Select a semester to view only records inside your current access scope.</p></div><span className="scope-pill"><FiShield /> {departmentScope ? `${departmentScope} only` : isAdmin ? 'All departments' : `${user.department} only`}</span></div>
      <div className="semester-picker-list">{semesterCounts.map(({ semester, count }, index) => <button type="button" className={`semester-picker-item ${semester === selectedSemester ? 'active' : ''}`} key={semester} onClick={() => setSelectedSemester(semester)}><span className="semester-picker-number">{semesterOrdinals[index]}</span><span className="semester-picker-label">Semester {semester}</span><span className="semester-picker-count">{count == null ? 'Unavailable' : `${count} ${count === 1 ? 'student' : 'students'}`}</span><FiChevronRight /></button>)}</div>
    </section>
    <div className="kpi-grid">
      <div className="kpi-card primary"><div className="kpi-top"><span className="kpi-label">Total students</span><span className="kpi-icon"><FiUsers /></span></div><div className="kpi-value">{total || 0}</div><span className="kpi-change"><FiUsers /> Current scope</span></div>
      <div className="kpi-card mint"><div className="kpi-top"><span className="kpi-label">Average attendance</span><span className="kpi-icon"><FiClock /></span></div><div className="kpi-value">{avgAttendance === '—' ? avgAttendance : `${avgAttendance}%`}</div><span className="kpi-change"><FiClock /> Current records</span></div>
      <div className="kpi-card sky"><div className="kpi-top"><span className="kpi-label">Average GPA</span><span className="kpi-icon"><FiTrendingUp /></span></div><div className="kpi-value">{avgCurrentGpa}</div><span className="kpi-change"><FiTrendingUp /> Current records</span></div>
      <div className="kpi-card peach"><div className="kpi-top"><span className="kpi-label">Need attention</span><span className="kpi-icon"><FiAlertCircle /></span></div><div className="kpi-value">{atRisk}</div><span className="kpi-change alert"><FiAlertCircle /> Current risk flags</span></div>
    </div>
    {isAdmin && <section className="admin-overview-stat-grid" aria-label="Administration summary"><article className="admin-overview-stat"><span><FiUsers /> Teachers</span><strong>{totalTeachers}</strong><small>Active accounts in this scope</small></article><article className="admin-overview-stat"><span><FiUser /> Parents</span><strong>{totalParents}</strong><small>Linked parent accounts</small></article><article className="admin-overview-stat"><span><FiBookOpen /> Configured subjects</span><strong>{totalConfiguredSubjects}</strong><small>Active catalog records</small></article><article className="admin-overview-stat"><span><FiGrid /> Semesters</span><strong>{totalSemesters}</strong><small>{adminSummary?.configuration?.semesterCrudSupported ? 'Configurable' : 'Fixed academic structure'}</small></article><button className="admin-overview-stat model" type="button" onClick={() => onNavigate('evaluation')}><span><FiZap /> XGBoost evaluation</span><strong>{modelStatus}</strong><small>{modelDetail}</small></button></section>}
    <div className="chart-grid">
      <section className="content-card"><div className="card-heading"><div><h2 className="card-title">Attendance by semester</h2><p className="card-description">Average attendance from the current scoped student records</p></div><span className="scope-pill"><FiClock /> {total} records</span></div><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={semesterAttendance} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="semester" axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="attendance" fill="#138A8A" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
      <section className="content-card"><div className="card-heading"><div><h2 className="card-title">Risk distribution</h2><p className="card-description">Prediction values in the current roster</p></div><span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#5BAA87' }} /> Current records</span></div><div className="risk-card-content"><div className="risk-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75} paddingAngle={3} stroke="none"><Cell fill={pieColors[0]} /><Cell fill={pieColors[1]} /><Cell fill={pieColors[2]} /></Pie></PieChart></ResponsiveContainer><div className="risk-center"><strong>{total}</strong><span>students</span></div></div><div className="risk-legend">{riskData.map((item, index) => <div className="legend-item" key={item.name}><i className="legend-dot" style={{ background: pieColors[index] }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div></div></section>
    </div>
    {isAdmin && <section className="content-card admin-academic-summary"><div className="card-heading"><div><h2 className="card-title">Academic performance overview</h2><p className="card-description">Department-wide averages from the current authorized records</p></div><span className="scope-pill"><FiActivity /> {department}</span></div><div className="admin-academic-metrics"><div><span>Internal marks</span><strong>{academicMetric('averageInternalMarks', 'averageInternalMarks', '%')}</strong></div><div><span>Assignment score</span><strong>{academicMetric('averageAssignmentScore', 'averageAssignmentScore', '%')}</strong></div><div><span>Previous GPA</span><strong>{academicMetric('averagePreviousGpa', 'previousGpa', ' / 10')}</strong></div><div><span>Participation</span><strong>{academicMetric('averageParticipationScore', 'participationScore', '%')}</strong></div><div><span>Pass / Fail</span><strong>{academic.pass === undefined && academic.fail === undefined ? '—' : `${academic.pass || 0} / ${academic.fail || 0}`}</strong></div></div><div className="table-scroll admin-semester-summary-table"><table className="student-table"><thead><tr><th>Semester</th><th>Students</th><th>Subjects</th><th>Attendance</th><th>Internal marks</th><th>Assignments</th><th>Previous GPA</th><th>Participation</th></tr></thead><tbody>{academicSemesterRows.map((row) => <tr key={row.semester}><td>Semester {row.semester}</td><td>{row.studentCount || 0}</td><td>{row.subjectCount || 0}</td><td>{row.averageAttendance === '—' || row.averageAttendance == null ? '—' : `${Number(row.averageAttendance).toFixed(1)}%`}</td><td>{row.averageInternalMarks === '—' || row.averageInternalMarks == null ? '—' : `${Number(row.averageInternalMarks).toFixed(1)}%`}</td><td>{row.averageAssignmentScore === '—' || row.averageAssignmentScore == null ? '—' : `${Number(row.averageAssignmentScore).toFixed(1)}%`}</td><td>{row.averagePreviousGpa === '—' || row.averagePreviousGpa == null ? '—' : `${Number(row.averagePreviousGpa).toFixed(1)} / 10`}</td><td>{row.averageParticipationScore === '—' || row.averageParticipationScore == null ? '—' : `${Number(row.averageParticipationScore).toFixed(1)}%`}</td></tr>)}</tbody></table></div></section>}
    {adminSummaryError && isAdmin && <DashboardDataNotice message={`Administration summary unavailable: ${adminSummaryError}`} onRetry={onRetrySummary} />}
    <section className="content-card alerts-card"><div className="card-heading"><div><h2 className="card-title">Needs a closer look</h2><p className="card-description">A short list for a more intentional follow-up</p></div><button className="button-ghost" type="button" onClick={() => onNavigate('prediction')}>Open prediction desk <FiArrowRight /></button></div><div className="alert-list">{alerts.length ? alerts.map((student) => <div className="alert-row" key={student.id}><Avatar initials={student.initials} tone={student.risk === 'High Risk' ? '' : 'mint'} /><div className="alert-info"><strong>{student.name}</strong><span>{student.usn} · {student.attendancePercentage}% attendance · {student.currentGpa} current GPA</span></div><RiskBadge risk={student.risk} /><FiChevronRight className="alert-arrow" /></div>) : <div className="empty-state">No students need attention right now.</div>}</div></section>
    <section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">Semester {selectedSemester} students</h2><p className="card-description">{semesterStudents.length} learners in {isAdmin ? 'the current access scope' : `${user.department} · all sections`}</p></div><div className="table-tools"><div className="search-field"><FiSearch /><input placeholder="Search students" aria-label="Search students" /></div><button className="filter-btn" type="button" onClick={() => onNavigate('students')}><FiFilter /> Filter</button></div></div><StudentTable students={semesterStudents.slice(0, 6)} compact onView={(student) => onNavigate('student', student)} /></section>
  </div>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload.find((item) => item.dataKey === 'attendance') || payload[0]
  return <div className="custom-tooltip"><p>{label}</p><strong>{point.value}% attendance</strong></div>
}

function StudentTable({ students, compact = false, onView, onEdit, onDelete }) {
  if (!students.length) return <div className="empty-state"><FiUsers /><span>No students match the selected filters.</span></div>
  return <div className="table-scroll"><table className="student-table"><thead><tr><th>Student</th><th>Semester</th><th>Section</th><th>Attendance</th><th>Current GPA</th><th>Risk level</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><div className="student-cell"><Avatar initials={student.initials} tone={student.risk === 'Low Risk' ? 'mint' : ''} /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div></td><td>Sem {student.semester}</td><td>{student.section}</td><td><div className="progress-inline"><span className="progress-track"><i className={`progress-fill ${student.attendancePercentage < 75 ? 'danger' : student.attendancePercentage < 80 ? 'warn' : ''}`} style={{ width: `${Math.min(student.attendancePercentage, 100)}%` }} /></span><span>{student.attendancePercentage}%</span></div></td><td><strong style={{ color: '#15263a' }}>{Number(student.currentGpa).toFixed(1)}</strong></td><td><RiskBadge risk={student.risk} /></td><td><div className="row-actions"><button className="row-action" type="button" onClick={() => onView?.(student)} aria-label={`View ${student.name}`}><FiEye /></button>{!compact && <><button className="row-action" type="button" onClick={() => onEdit?.(student)} aria-label={`Edit ${student.name}`}><FiEdit3 /></button><button className="row-action" type="button" onClick={() => onDelete?.(student)} aria-label={`Delete ${student.name}`}><FiTrash2 /></button></>}</div></td></tr>)}</tbody></table></div>
}

function StudentsView({ user, students, setStudents, onAddStudent, onUpload, onExport, showToast, selectedStudent, setSelectedStudent, remarks = [], achievements = [], subjects = [] }) {
  const navigate = useNavigate()
  const admin = user.role === 'admin'
  const departmentScope = user.department === 'ALL' ? '' : user.department
  const [semester, setSemester] = useState(user.role === 'teacher' ? '7' : 'all')
  const [department, setDepartment] = useState(admin ? departmentScope || 'all' : user.department)
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('all')
  const [editing, setEditing] = useState(null)
  const filtered = useMemo(() => students.filter((student) => (departmentScope ? student.department === departmentScope : admin ? department === 'all' || student.department === department : student.department === user.department) && (semester === 'all' || String(student.semester) === semester) && (risk === 'all' || student.risk === risk) && `${student.name} ${student.usn}`.toLowerCase().includes(query.toLowerCase())), [students, admin, department, departmentScope, user.department, semester, risk, query])
  const scopeTotal = departmentScope ? students.filter((student) => student.department === departmentScope).length : students.length
  const viewStudent = (student) => user.role === 'teacher'
    ? navigate(`/teacher/student/${encodeURIComponent(student.usn)}?semester=${student.semester}&section=${encodeURIComponent(student.section)}`)
    : setSelectedStudent(student)
  const saveEdit = async (updated) => { let record = updated; if (!DEMO_MODE) { try { const response = await api.updateStudent(updated.id, updated); record = response.data || updated } catch { showToast('API unavailable · updated locally for this session') } } setStudents((current) => current.map((student) => student.id === record.id ? record : student)); setEditing(null); showToast('Student record updated') }
  const deleteStudent = async (student) => { if (window.confirm(`Remove ${student.name} from the demo roster?`)) { if (!DEMO_MODE) { try { await api.deleteStudent(student.id) } catch { showToast('API unavailable · removed locally for this session') } } setStudents((current) => current.filter((item) => item.id !== student.id)); showToast('Student record removed') } }
  return <div className="dashboard-content"><PageIntro eyebrow="Student management" title="Student records" description="Search, review and maintain the academic roster with confidence." actions={<><button className="button-ghost" type="button" onClick={onExport}><FiDownload /> Export .xlsx</button><button className="button-ghost" type="button" onClick={onUpload}><FiUploadCloud /> Upload</button><button className="button-primary" type="button" onClick={onAddStudent}><FiPlus /> Manual add</button></>} /><div className="toolbar-card"><div className="search-field"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or USN" aria-label="Search by name or USN" /></div><div className="toolbar-filters"><select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter department" disabled={Boolean(departmentScope)} title={departmentScope ? `Scoped to ${departmentScope}` : undefined}><option value="all">All departments</option><option value="CSE">CSE</option><option value="AIML">AIML</option><option value="CSDS">CSDS</option><option value="CE">CE</option><option value="ECE">ECE</option><option value="EEE">EEE</option><option value="ME">ME</option><option value="CIVIL">CIVIL</option></select><select value={semester} onChange={(event) => setSemester(event.target.value)} aria-label="Filter semester"><option value="all">All semesters</option>{semesters.map((item) => <option key={item} value={item}>Semester {item}</option>)}</select><select value={risk} onChange={(event) => setRisk(event.target.value)} aria-label="Filter risk"><option value="all">All risk levels</option><option value="Low Risk">Low Risk</option><option value="Medium Risk">Medium Risk</option><option value="High Risk">High Risk</option></select></div></div><section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">Roster overview</h2><p className="card-description">Showing {filtered.length} of {scopeTotal} records · sorted by USN</p></div><span className="department-note"><FiShield /> {admin ? 'Admin access' : `${user.department} access only`}</span></div><StudentTable students={filtered} onView={viewStudent} onEdit={setEditing} onDelete={deleteStudent} /><div className="table-footer"><span>Showing {filtered.length ? 1 : 0}–{Math.min(filtered.length, 10)} of {filtered.length} students</span><div className="pagination"><button type="button" className="active">1</button><button type="button">2</button><button type="button"><FiChevronRight /></button></div></div></section>{editing && <StudentFormModal student={editing} departmentScope={departmentScope} existingStudents={students} onClose={() => setEditing(null)} onSave={saveEdit} />}{selectedStudent && <StudentDetailModal student={selectedStudent} remarks={remarks} achievements={achievements} subjects={subjects} onClose={() => setSelectedStudent(null)} />}</div>
}

function AdminReportsView({ user, students }) {
  const departmentScope = user.department === 'ALL' ? '' : user.department
  const [department, setDepartment] = useState(departmentScope || 'all')
  const [semester, setSemester] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const filtered = useMemo(() => students.filter((student) =>
    (departmentScope ? student.department === departmentScope : department === 'all' || student.department === department)
    && (semester === 'all' || String(student.semester) === semester)
    && `${student.name} ${student.usn}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [students, departmentScope, department, semester, query])
  const selectedStudents = filtered.filter((student) => selectedIds.includes(Number(student.id)))
  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selectedIds.includes(Number(student.id)))
  const reportScope = {
    ...(department !== 'all' ? { department } : {}),
    ...(semester !== 'all' ? { semester: Number(semester) } : {}),
  }

  useEffect(() => {
    const visibleIds = new Set(filtered.map((student) => Number(student.id)))
    setSelectedIds((current) => current.filter((id) => visibleIds.has(Number(id))))
  }, [filtered])

  const toggleStudent = (studentId, forceValue) => {
    const id = Number(studentId)
    setSelectedIds((current) => {
      const selected = current.includes(id)
      const nextSelected = forceValue === undefined ? !selected : forceValue
      return nextSelected ? [...new Set([...current, id])] : current.filter((item) => item !== id)
    })
  }

  return <div className="dashboard-content admin-reports-page"><PageIntro eyebrow="Administration · Academic reports" title="Academic reports" description="Select authorized student records and generate the existing report-card PDFs without changing the stored academic data." actions={<span className="scope-pill"><FiShield /> {departmentScope ? `${departmentScope} only` : 'All departments'}</span>} /><div className="semester-context-banner"><FiFileText /><span>Report cards use the existing authorization and report-card rendering workflow. Only the records currently returned for this admin scope can be selected.</span></div><div className="toolbar-card"><div className="search-field"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or USN" aria-label="Search report-card records" /></div><div className="toolbar-filters"><select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter report department" disabled={Boolean(departmentScope)} title={departmentScope ? `Scoped to ${departmentScope}` : undefined}><option value="all">All departments</option>{departments.map((item) => <option value={item.code} key={item.code}>{item.code}</option>)}</select><select value={semester} onChange={(event) => setSemester(event.target.value)} aria-label="Filter report semester"><option value="all">All semesters</option>{semesters.map((item) => <option value={item} key={item}>Semester {item}</option>)}</select><span className="scope-pill">{filtered.length} records</span></div></div>{selectedStudents.length > 0 && <div className="report-card-bulk-toolbar"><div><strong>{selectedStudents.length} selected</strong><span>Separate PDFs will be packaged into one ZIP file.</span></div><ReportCardDownloadButton bulkStudentIds={selectedStudents.map((student) => student.id)} reportStudents={selectedStudents} scope={reportScope} label="Download selected report cards" className="button-primary" onComplete={() => window.setTimeout(() => setSelectedIds([]), 1400)} /><button className="button-ghost" type="button" onClick={() => setSelectedIds([])}>Clear</button></div>}<section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">Report-card roster</h2><p className="card-description">{filtered.length} authorized record{filtered.length === 1 ? '' : 's'} in the current filter</p></div><label className="department-note report-card-select-all"><input type="checkbox" checked={allVisibleSelected} onChange={(event) => filtered.forEach((student) => toggleStudent(student.id, event.target.checked))} disabled={!filtered.length} /> Select visible</label></div>{filtered.length ? <div className="table-scroll"><table className="student-table"><thead><tr><th className="report-card-select-cell"><span className="sr-only">Select</span></th><th>Student</th><th>Department</th><th>Semester</th><th>Section</th><th>Attendance</th><th>Current GPA</th><th>Risk level</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id}><td className="report-card-select-cell"><input type="checkbox" checked={selectedIds.includes(Number(student.id))} onChange={() => toggleStudent(student.id)} aria-label={`Select ${student.name}`} /></td><td><div className="student-cell"><Avatar initials={student.initials} tone={student.risk === 'Low Risk' ? 'mint' : ''} /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div></td><td>{student.department}</td><td>Sem {student.semester}</td><td>{student.section}</td><td>{student.attendancePercentage}%</td><td><strong style={{ color: '#15263a' }}>{Number(student.currentGpa).toFixed(1)}</strong></td><td><RiskBadge risk={student.risk} /></td></tr>)}</tbody></table></div> : <div className="empty-state"><FiFileText /><span>No authorized student records match the selected filters.</span></div>}</section></div>
}

function PredictionView({ user, students, showToast, apiSession = false }) {
  const scope = user.department === 'ALL' ? students : students.filter((student) => student.department === user.department)
  const [selectedId, setSelectedId] = useState(scope[0]?.id || '')
  const selected = scope.find((student) => String(student.id) === String(selectedId)) || scope[0]
  const [features, setFeatures] = useState(() => selected ? predictionFields(selected) : Object.fromEntries(PREDICTION_INPUTS.map(({ key }) => [key, ''])))
  const [prediction, setPrediction] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selected) {
      setSelectedId('')
      setFeatures(Object.fromEntries(PREDICTION_INPUTS.map(({ key }) => [key, ''])))
      setPrediction(null)
      return
    }
    setFeatures(predictionFields(selected))
    setPrediction(null)
    setError('')
  }, [selectedId, selected?.id])

  const setFromStudent = (id) => setSelectedId(id)
  const updateFeature = (key, value) => { setError(''); setFeatures((current) => ({ ...current, [key]: value === '' ? '' : Number(value) })) }
  const runPrediction = async () => {
    if (!selected) return
    if (!apiSession) {
      setError('A live API session is required. Demo mode does not claim to run a model prediction.')
      return
    }
    setRunning(true)
    setError('')
    try {
      const result = await api.predict(features)
      if (!result?.result || !result?.risk) throw new Error('The prediction service returned no usable result.')
      setPrediction(result)
      showToast(result.model === 'deterministic-fallback' ? 'API returned a fallback prediction; review the audit label.' : 'Prediction returned by the configured ML service.')
    } catch (predictionError) {
      setError(predictionError.response?.data?.message || predictionError.message || 'The prediction service is unavailable. No prediction was shown.')
      setPrediction(null)
    } finally {
      setRunning(false)
    }
  }
  const modelLabel = prediction?.model === 'xgboost' ? 'Configured XGBoost service' : prediction?.model === 'deterministic-fallback' ? 'Deterministic API fallback · audit only' : apiSession ? 'Prediction endpoint ready' : 'Unavailable in demo mode'
  const statusClass = prediction?.model === 'xgboost' ? 'available' : prediction?.model ? 'fallback' : apiSession ? '' : 'unavailable'

  return <div className="dashboard-content prediction-desk-page"><div className="prediction-desk-header"><PageIntro eyebrow="Academic monitoring · Prediction" title="Prediction desk" description="Run the existing prediction endpoint only for the authorized student scope. Results are labelled by their actual source." actions={<span className={`prediction-desk-status ${statusClass}`}><i /> {modelLabel}</span>} /></div><div className="semester-context-banner"><FiShield /><span>Five monitored inputs are editable for a what-if check. A stored risk summary is not presented as a live model result, and unavailable services never receive a fabricated score.</span></div><div className="prediction-desk-grid"><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Run a prediction</h2><p className="card-description">The API validates attendance, internal marks, assignments, previous GPA and participation.</p></div><span className="scope-pill"><FiActivity /> {scope.length} authorized records</span></div>{scope.length ? <><div className="form-field" style={{ marginTop: 18 }}><label className="plain-label" htmlFor="prediction-student">Choose student</label><select id="prediction-student" className="field-control" value={selected?.id || ''} onChange={(event) => setFromStudent(event.target.value)}>{scope.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.usn}</option>)}</select></div><div className="prediction-form-grid">{PREDICTION_INPUTS.map(({ key, label, suffix, min, max, step }) => <div className="form-field" key={key}><label className="plain-label" htmlFor={`prediction-${key}`}>{label}</label><div className="academic-input-wrap"><input id={`prediction-${key}`} className="field-control" type="number" min={min} max={max} step={step} value={features[key]} onChange={(event) => updateFeature(key, event.target.value)} /><small>{suffix}</small></div></div>)}</div>{error && <div className="validation-error" role="alert">{error}</div>}<p className="prediction-input-note">Scope: {user.department === 'ALL' ? 'all departments' : `${user.department} department`}. Current GPA is not sent to the five-input prediction endpoint.</p><button className="button-primary full-button" type="button" onClick={runPrediction} disabled={running || !apiSession}><FiZap /> {running ? 'Requesting prediction…' : apiSession ? 'Run API prediction' : 'Prediction unavailable in demo mode'}</button></> : <div className="empty-state"><FiUsers /><span>No authorized student records are available for this workspace.</span></div>}</section><section className="content-card prediction-result-card"><div className="card-heading"><div><h2 className="card-title">Latest returned result</h2><p className="card-description">Only a response from the existing API is shown here.</p></div><FiZap /></div>{prediction && selected ? <><div className="result-student"><Avatar initials={selected.initials} tone={prediction.risk === 'Low Risk' ? 'mint' : ''} /><div><h2>{selected.name}</h2><p>{selected.usn} · Semester {selected.semester}</p></div></div><div className={`result-risk ${riskKey(prediction.risk)}`}><span>Result</span><strong>{prediction.result}</strong></div><div className={`result-risk ${riskKey(prediction.risk)}`}><span>Risk level</span><strong>{prediction.risk}</strong><RiskBadge risk={prediction.risk} /></div><div className="prediction-result-list"><div><span>Response model</span><strong>{prediction.model || 'Not supplied'}</strong></div><div><span>Inputs echoed by API</span><strong>{prediction.inputs ? 'Yes' : 'No'}</strong></div></div><div className="result-note"><FiShield /><span>{prediction.model === 'deterministic-fallback' ? 'This is a deterministic API fallback, not evidence of a trained XGBoost model.' : 'Prediction is a support signal, not an automated decision. Pair it with academic context.'}</span></div></> : <div className="empty-state"><FiActivity /><span>Run the authorized API prediction to see a returned result.</span>{selected?.risk && <small>Stored record signal: {selected.risk}. This is not displayed as a live model output.</small>}</div>}</section></div><section className="content-card model-status-card"><FiInfo /><div><strong>Model and evaluation status</strong><p>For real accuracy, precision, recall, F1 and confusion-matrix evidence, open Model evaluation. If its report is unavailable or audit-only, this desk does not infer metrics from roster data.</p></div><button className="button-ghost" type="button" onClick={() => window.location.assign('/app/evaluation')}>Open evaluation <FiArrowRight /></button></section></div>
}

function MessagesView({ user, messages, setMessages, setUnreadCount = () => {}, showToast, readOnly = false, students = [] }) {
  const [selectedId, setSelectedId] = useState(messages[0]?.id)
  const [search, setSearch] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [replySending, setReplySending] = useState(false)
  const visible = messages.filter((message) => `${message.sender} ${message.recipient} ${message.subject} ${message.body}`.toLowerCase().includes(search.toLowerCase()))
  const isIncoming = (message) => message.senderRole ? message.senderRole !== user.role : message.sender !== user.name
  const selected = messages.find((message) => message.id === selectedId) || visible[0]
  useEffect(() => {
    if (visible[0] && (!selectedId || !messages.some((message) => message.id === selectedId))) setSelectedId(visible[0].id)
  }, [selectedId, messages, visible])
  useEffect(() => {
    const opened = messages.find((message) => message.id === selectedId)
    if (!opened || opened.read || !isIncoming(opened)) return
    selectMessage(opened)
  // Selecting an inbox item is the explicit read action; this also handles the first item opened on load.
  }, [selectedId])
  const canReply = ['student', 'parent', 'teacher', 'admin'].includes(user.role)
  const selectMessage = async (message) => {
    setSelectedId(message.id)
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, read: true, readStatus: true } : item))
    if (DEMO_MODE) markDemoMessageRead(message.id)
    if (!message.read && isIncoming(message)) setUnreadCount((count) => Math.max(0, count - 1))
    if (!DEMO_MODE && !message.read && message.receiverRole === user.role && Number(message.receiverId) === Number(user.id)) {
      try { await api.markMessageRead(message.id) } catch (error) { showToast(error.response?.data?.message || 'The message could not be marked as read.') }
    }
  }
  const sendMessage = async (payload) => {
    const fallback = { ...payload, recipientId: payload.recipientId || payload.demoRecipientId, id: Date.now(), senderId: user.id, senderRole: user.role, sender: user.name, time: 'Just now', createdAt: new Date().toISOString(), read: true, readStatus: true, initials: user.initials }
    const { demoRecipientId: _demoRecipientId, ...requestPayload } = payload
    try {
      const response = DEMO_MODE ? null : await api.sendMessage(requestPayload)
      const saved = response?.data || fallback
      setMessages((current) => [saved, ...current])
      if (DEMO_MODE) upsertDemoMessage(saved)
      window.dispatchEvent(new window.Event('camps-messages-updated'))
      setComposeOpen(false)
      showToast(`Message delivered to ${saved.recipient || 'the selected recipient'}`)
      return true
    } catch (error) {
      console.error('[messages] Dashboard delivery failed.', { status: error.response?.status || 'network', message: error.response?.data?.message || error.message })
      showToast(error.response?.data?.message || 'Message delivery failed. Nothing was saved.')
      return false
    }
  }
  const sendReply = async (event) => {
    event.preventDefault()
    if (!selected || !reply.trim()) { showToast('Write a reply before sending.'); return }
    const recipientRole = selected.senderRole === user.role ? selected.receiverRole : selected.senderRole
    const recipientId = selected.senderRole === user.role ? selected.receiverId : selected.senderId
    if (!recipientRole || !recipientId) { showToast('This conversation has no valid recipient mapping.'); return }
    setReplySending(true)
    const payload = { recipientRole, recipientId: Number(recipientId), studentId: selected.studentId || user.studentId, subject: `Re: ${selected.subject}`.replace(/^Re: Re:/, 'Re:'), body: reply.trim(), department: selected.department || user.department, semester: selected.semester || user.semester, section: selected.section }
    const saved = await sendMessage(payload)
    if (saved) setReply('')
    setReplySending(false)
  }
  return <div className="dashboard-content"><PageIntro eyebrow="Keep the loop warm" title="Messages" description={user.role === 'parent' ? 'Direct messages from your student’s teachers, with secure replies.' : 'Direct, searchable conversations with students and families.'} actions={!readOnly && user.role !== 'parent' && <button className="button-primary" type="button" onClick={() => setComposeOpen(true)}><FiPlus /> New message</button>} /><div className="messages-layout"><div className="message-list"><div className="message-list-head"><h3>Inbox <span style={{ color: '#138A8A' }}>· {messages.filter((message) => !message.read && isIncoming(message)).length} unread</span></h3>{!readOnly && user.role !== 'parent' && <button type="button" onClick={() => setComposeOpen(true)} aria-label="Compose message"><FiPlus /></button>}</div><div className="message-search search-field"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inbox" /></div>{visible.map((message) => <button className={`message-item ${selected?.id === message.id ? 'active' : ''}`} type="button" key={message.id} onClick={() => selectMessage(message)}><Avatar initials={message.initials || 'CA'} tone={message.senderRole === 'parent' || message.receiverRole === 'parent' ? 'sky' : ''} /><span className="message-item-content"><span className="message-item-line"><strong>{message.sender}{!message.read && isIncoming(message) && <i className="unread-dot" />}</strong><time>{String(message.time || message.created_at || message.createdAt || '').replace('Today, ', '')}</time></span><p>{message.subject}</p><small>{message.recipient}</small></span></button>)}{!visible.length && <div className="empty-state"><FiMail /><span>No messages found.</span></div>}</div><div className="message-detail">{selected ? <><div className="message-detail-head"><div><h2>{selected.subject}</h2><p>From {selected.sender} · To {selected.recipient} · {selected.time || selected.createdAt}</p></div><button className="row-action" type="button" aria-label="More message actions"><FiMoreHorizontal /></button></div><div className="message-body"><div className="message-bubble">{selected.body}</div></div>{canReply && <form className="message-detail-footer" onSubmit={sendReply}><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to this conversation…" aria-label="Reply to this conversation" /><button type="submit" disabled={replySending || !selected.senderRole} aria-label="Send reply"><FiSend /></button></form>}</> : <div className="empty-state"><FiMail /><span>Select a message to read it.</span></div>}</div></div>{composeOpen && !readOnly && <MessageModal user={user} students={students} onClose={() => setComposeOpen(false)} onSend={sendMessage} />}</div>
}

function AnnouncementsView({ announcements, setAnnouncements, user, showToast, readOnly = false }) {
  const [composeOpen, setComposeOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const visible = announcements.filter((item) => filter === 'All' || item.type === filter)
  const createAnnouncement = async (item) => { let saved = { ...item, id: Date.now(), author: user.name, date: 'Just now' }; if (!DEMO_MODE) { try { const response = await api.createAnnouncement(item); saved = response.data || saved } catch { showToast('API unavailable · announcement saved locally for this session') } } setAnnouncements((current) => [saved, ...current]); setComposeOpen(false); showToast('Announcement published') }
  const remove = (item) => { if (window.confirm(`Delete “${item.title}”?`)) { setAnnouncements((current) => current.filter((announcement) => announcement.id !== item.id)); showToast('Announcement deleted') } }
  return <div className="dashboard-content"><PageIntro eyebrow="Keep everyone aligned" title="Announcements" description="One clear message, delivered to the people who need it." actions={!readOnly && <button className="button-primary" type="button" onClick={() => setComposeOpen(true)}><FiPlus /> Create announcement</button>} /><div className="toolbar-card"><div><strong style={{ color: '#15263a', fontSize: 12 }}>Published updates</strong><span style={{ display: 'block', marginTop: 4, color: '#99a2a1', fontSize: 10 }}>Visible to your selected audience</span></div><div className="toolbar-filters">{['All', 'College', 'Department', 'Semester'].map((item) => <button key={item} type="button" className={`filter-btn ${filter === item ? 'selected-filter' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="announcement-grid">{visible.map((item) => <article className="announcement-card" key={item.id}><span className={`announcement-type ${item.type.toLowerCase()}`}>{item.type}{item.semester ? ` · Sem ${item.semester}` : item.department ? ` · ${item.department}` : ''}</span><h3>{item.title}</h3><p>{item.body}</p><div className="announcement-footer"><span>{item.date} · <strong>{item.author}</strong></span>{!readOnly && <div className="announcement-actions"><button type="button" onClick={() => showToast('Announcement edit form is ready')} aria-label="Edit announcement"><FiEdit3 /></button><button type="button" onClick={() => remove(item)} aria-label="Delete announcement"><FiTrash2 /></button></div>}</div></article>)}{!visible.length && <div className="empty-state"><FiBell /><span>No announcements in this view.</span></div>}</div>{composeOpen && !readOnly && <AnnouncementModal onClose={() => setComposeOpen(false)} onCreate={createAnnouncement} />}</div>
}

function RemarksView({ remarks, setRemarks, students, user, showToast }) {
  const [composeOpen, setComposeOpen] = useState(false)
  const createRemark = async (remark) => { const student = students.find((item) => item.id === Number(remark.studentId)); let saved = { ...remark, id: Date.now(), studentName: student?.name || 'Student', date: 'Just now', author: user.name }; if (!DEMO_MODE) { try { const response = await api.createRemark(remark); saved = response.data || saved } catch { showToast('API unavailable · saved locally for this session') } } setRemarks((current) => [saved, ...current]); setComposeOpen(false); showToast('Teacher remark saved') }
  return <div className="dashboard-content"><PageIntro eyebrow="Context behind the data" title="Teacher remarks" description="Add the human detail that helps students and families move forward." actions={<button className="button-primary" type="button" onClick={() => setComposeOpen(true)}><FiPlus /> Add remark</button>} /><section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">Recent remarks</h2><p className="card-description">Visible to the student and their parent</p></div><span className="department-note"><FiEye /> Shared visibility</span></div><div className="table-scroll"><table className="remark-table"><thead><tr><th>Student</th><th>Remark</th><th>Note</th><th>Added</th></tr></thead><tbody>{remarks.map((remark) => <tr key={remark.id}><td><strong style={{ color: '#15263a' }}>{remark.studentName}</strong></td><td><span className={`remark-label ${remark.label.includes('Excellent') ? 'excellent' : remark.label.includes('Performance') ? 'good' : ''}`}>{remark.label}</span></td><td>{remark.note}</td><td>{remark.date}</td></tr>)}</tbody></table></div></section><div className="info-band" style={{ marginTop: 13 }}><article className="info-card mint"><span className="info-icon"><FiHeart /></span><h3>Lead with context</h3><p>A short, specific observation can make an alert feel actionable rather than alarming.</p></article><article className="info-card sky"><span className="info-icon"><FiUsers /></span><h3>Shared with care</h3><p>Remarks are visible to the student and parent linked to the record.</p></article><article className="info-card peach"><span className="info-icon"><FiCheckCircle /></span><h3>Small steps count</h3><p>Celebrate progress and make the next step clear.</p></article></div>{composeOpen && <RemarkModal students={students} onClose={() => setComposeOpen(false)} onCreate={createRemark} />}</div>
}

function learnerStudentFor(user, students) {
  return students.find((item) => item.usn && user.usn && String(item.usn).toUpperCase() === String(user.usn).toUpperCase())
    || students.find((item) => Number(item.id) === Number(user.studentId || user.id))
    || students.find((item) => item.name === user.studentName || item.name === user.name)
}

function LearnerDataEmpty({ user }) {
  return <DashboardDataState title="Student record unavailable" message={`We could not find an active student record linked to this ${user.role} account. Please contact the academic office or try again.`} />
}

function RecordsView({ user, students, achievements, subjects, onNavigate }) {
  const student = learnerStudentFor(user, students)
  if (!student) return <LearnerDataEmpty user={user} />
  const academic = academicFields(student)
  const outcome = student.result || predictAcademic(student).result
  const risk = student.risk || predictAcademic(student).risk
  const studentAchievements = (achievements || []).filter((achievement) => Number(achievement.studentId) === Number(student.id) || achievement.usn === student.usn)
  return <div className="dashboard-content"><PageIntro eyebrow="Your academic record" title="Average Academic Performance" description="A read-only view of your teacher-entered Average Academic Performance record." actions={<ReportCardDownloadButton studentId={student.id} usn={student.usn} scope={{ department: student.department, semester: student.semester, section: student.section }} reportData={{ student, subjects, achievements: studentAchievements }} />} /><section className="content-card"><div className="student-detail-hero"><Avatar initials={student.initials} tone="mint" /><div><h2>{student.name}</h2><p>{student.usn} · {student.department} · Semester {student.semester} · Section {student.section}</p></div><span style={{ marginLeft: 'auto' }}><RiskBadge risk={risk} /></span></div><div className="profile-stat-grid academic-performance-grid" style={{ marginTop: 20 }}>{ACADEMIC_ATTRIBUTES.map(({ key, label, suffix }) => <div key={key}><span>{label}</span><strong>{Number(academic[key]).toFixed(1)}</strong><small>{suffix}</small></div>)}</div><div className="detail-list" style={{ marginTop: 18 }}><div className="detail-item"><span>Prediction</span><strong>{outcome}</strong></div><div className="detail-item"><span>Risk level</span><strong>{risk}</strong></div></div></section><LearnerSubjectCatalog subjects={subjects} student={student} /><section className="content-card learner-record-achievements"><div className="card-heading"><div><h2 className="card-title">Achievements</h2><p className="card-description">Read-only milestones attached to this academic record</p></div><FiAward /></div><div className="learner-achievement-list">{studentAchievements.map((achievement) => <article className="learner-achievement-row" key={achievement.id}><span className="learner-achievement-icon"><FiAward /></span><div><div className="achievement-record-meta"><span className="achievement-type-pill">{achievement.achievementType}</span><time>{achievement.date}</time></div><h3>{achievement.title}</h3><p>{achievement.description}</p></div></article>)}{!studentAchievements.length && <div className="empty-state"><FiAward /><span>No achievements recorded yet.</span></div>}</div></section></div>
}

function AchievementsView({ user, students, achievements, onNavigate }) {
  const student = learnerStudentFor(user, students)
  if (!student) return <LearnerDataEmpty user={user} />
  const visible = (achievements || []).filter((achievement) => Number(achievement.studentId) === Number(student.id) || achievement.usn === student.usn)
  const formatDate = (value) => { const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? value || 'Date not recorded' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
  return <div className="dashboard-content"><PageIntro eyebrow={`${student.department} · Semester ${student.semester} · Section ${student.section}`} title="Achievements" description={user.role === 'parent' ? `A read-only record of ${student.name}'s achievements and milestones.` : 'A read-only record of your achievements and milestones.'} actions={<span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#5BAA87' }} /> Read-only academic record</span>} /><div className="semester-context-banner"><FiShield /><span>These records were added by your teacher and are visible to the linked student and parent portals.</span></div><section className="content-card learner-achievements-card"><div className="table-card-head"><div><h2 className="card-title">{student.name}</h2><p className="card-description">{visible.length} achievement{visible.length === 1 ? '' : 's'} · {student.department} Semester {student.semester} Section {student.section}</p></div><span className="scope-pill"><FiAward /> Verified record</span></div><div className="learner-achievement-list">{visible.map((achievement) => <article className="learner-achievement-row" key={achievement.id}><span className="learner-achievement-icon"><FiAward /></span><div><div className="achievement-record-meta"><span className="achievement-type-pill">{achievement.achievementType}</span><time>{formatDate(achievement.date)}</time></div><h3>{achievement.title}</h3><p>{achievement.description}</p><small>Recorded by {achievement.author || 'Teacher'}</small></div></article>)}{!visible.length && <div className="empty-state"><FiAward /><span>No achievements have been recorded yet.</span></div>}</div></section></div>
}

function LearnerOverview({ user, students, announcements, messages, remarks, achievements, subjects, onNavigate }) {
  const student = learnerStudentFor(user, students)
  if (!student) return <LearnerDataEmpty user={user} />
  const academic = academicFields(student)
  const outcome = student.result || predictAcademic(student).result
  const risk = student.risk || predictAcademic(student).risk
  const isParent = user.role === 'parent'
  const relevantRemarks = remarks.filter((remark) => remark.studentId === student.id)
  const relevantAchievements = (achievements || []).filter((achievement) => Number(achievement.studentId) === Number(student.id) || achievement.usn === student.usn)
  return <div className="dashboard-content"><PageIntro eyebrow={isParent ? `Family view · ${student.department}` : `${student.department} · Semester ${student.semester}`} title={isParent ? `Hello, ${user.name.split(' ')[0]}.` : `Welcome back, ${student.name.split(' ')[0]}.`} description={isParent ? `Here is the latest academic picture for ${student.name}.` : 'A clear view of your progress, support and next steps.'} actions={<div className="page-actions-stack"><ReportCardDownloadButton studentId={student.id} usn={student.usn} scope={{ department: student.department, semester: student.semester, section: student.section }} reportData={{ student, subjects, remarks: relevantRemarks, achievements: relevantAchievements }} /><span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#5BAA87' }} /> Read-only view</span></div>} /><LearnerSubjectCatalog subjects={subjects} student={student} /><div className="profile-stat-grid academic-performance-grid"><div><span>Attendance Percentage</span><strong>{academic.attendancePercentage.toFixed(1)}</strong><small>%</small></div><div><span>Current GPA</span><strong>{academic.currentGpa.toFixed(1)}</strong><small>/ 10</small></div><div><span>Prediction</span><strong>{outcome}</strong><small><RiskBadge risk={risk} /></small></div></div><div className="prediction-banner"><div className="prediction-banner-copy"><h3>Average Academic Performance</h3><p>Teacher-entered academic attributes are used to monitor progress.</p></div><div className="prediction-score"><strong>{outcome}</strong><div><span>prediction</span><b><i style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#BCE7D7', marginRight: 5 }} />{risk}</b></div></div></div><div className="section-grid" style={{ marginTop: 13 }}><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Your attendance rhythm</h2><p className="card-description">Consistency is a superpower</p></div></div><div className="chart-container" style={{ height: 210 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={attendanceTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="learnerGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#75BFA5" stopOpacity=".3" /><stop offset="100%" stopColor="#75BFA5" stopOpacity=".02" /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis domain={[55, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="attendance" stroke="#5BAA87" strokeWidth={2.5} fill="url(#learnerGradient)" /></AreaChart></ResponsiveContainer></div></section><section className="student-detail-card"><div className="student-detail-hero"><Avatar initials={student.initials} tone="mint" /><div><h2>{student.name}</h2><p>{student.usn} · {student.department}</p></div></div><div className="detail-list"><div className="detail-item"><span>Average Internal Marks</span><strong>{academic.averageInternalMarks.toFixed(1)}%</strong></div><div className="detail-item"><span>Average Assignment Score</span><strong>{academic.averageAssignmentScore.toFixed(1)}%</strong></div><div className="detail-item"><span>Previous GPA</span><strong>{academic.previousGpa.toFixed(1)} / 10</strong></div><div className="detail-item"><span>Participation Score</span><strong>{academic.participationScore.toFixed(1)}%</strong></div></div></section></div><div className="section-grid" style={{ marginTop: 13 }}><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Teacher remarks</h2><p className="card-description">A little context for your next step</p></div><button className="button-ghost" type="button" onClick={() => onNavigate('messages')}>Open messages <FiArrowRight /></button></div>{relevantRemarks.length ? <div className="alert-list">{relevantRemarks.map((remark) => <div className="alert-row" key={remark.id}><Avatar initials="AR" /><div className="alert-info"><strong>{remark.label}</strong><span>{remark.note}</span></div><span style={{ color: '#a4acab', fontSize: 9 }}>{remark.date}</span></div>)}</div> : <div className="empty-state">No new remarks.</div>}</section><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Latest announcements</h2><p className="card-description">For {student.department} · Semester {student.semester}</p></div><button className="row-action" type="button" onClick={() => onNavigate('announcements')}><FiArrowRight /></button></div><div className="alert-list">{announcements.slice(0, 2).map((announcement) => <div className="alert-row" key={announcement.id}><span className="info-icon" style={{ width: 29, height: 29 }}><FiBell /></span><div className="alert-info"><strong>{announcement.title}</strong><span>{announcement.date}</span></div></div>)}</div></section></div><section className="content-card learner-overview-achievements"><div className="card-heading"><div><h2 className="card-title">Latest achievements</h2><p className="card-description">Milestones recorded in your academic record</p></div><button className="row-action" type="button" onClick={() => onNavigate('achievements')}><FiArrowRight /></button></div>{relevantAchievements.length ? <div className="alert-list">{relevantAchievements.slice(0, 2).map((achievement) => <div className="alert-row" key={achievement.id}><span className="info-icon" style={{ width: 29, height: 29 }}><FiAward /></span><div className="alert-info"><strong>{achievement.title}</strong><span>{achievement.achievementType} · {achievement.date}</span></div></div>)}</div> : <div className="empty-state"><FiAward /><span>No achievements recorded yet.</span></div>}</section></div>
}

function ProfileView({ user }) {
  return <div className="dashboard-content"><PageIntro eyebrow="Account profile" title={user.name} description="Your identity and access details for the CAMPS academic workspace." actions={<span className="scope-pill"><FiShield /> Authenticated profile</span>} /><section className="content-card profile-account-card"><div className="student-detail-hero"><Avatar initials={user.initials || 'CA'} tone="mint" /><div><h2>{user.name}</h2><p>{user.role === 'parent' ? `Parent account · linked to ${user.studentName || user.usn}` : `${user.role} account · ${user.department === 'ALL' ? 'All departments' : user.department}`}</p></div></div><div className="profile-detail-grid" style={{ marginTop: 24 }}><div><span>Full name</span><strong>{user.name}</strong></div><div><span>Role</span><strong>{user.role}</strong></div><div><span>Email</span><strong>{user.email || 'Not recorded'}</strong></div><div><span>Department scope</span><strong>{user.department === 'ALL' ? 'All departments' : user.department}</strong></div>{user.semester && <div><span>Semester</span><strong>Semester {user.semester}</strong></div>}{user.usn && <div><span>Linked USN</span><strong>{user.usn}</strong></div>}</div></section></div>
}

function SettingsView({ user }) {
  return <div className="dashboard-content"><PageIntro eyebrow="Workspace settings" title="Settings" description="Review the settings this authenticated account currently supports." actions={<span className="scope-pill"><FiShield /> Read-only access settings</span>} /><div className="semester-context-banner"><FiShield /><span>Profile, role and department scope are controlled by the authenticated session. No unsupported configuration changes are presented as saved.</span></div><section className="content-card"><div className="settings-row"><div><h2 className="card-title">Profile &amp; permissions</h2><p className="card-description">Your current identity and access scope</p></div><span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#5BAA87' }} /> JWT secured</span></div><div className="form-grid" style={{ marginTop: 24 }}><div className="form-field"><label className="plain-label">Full name</label><input className="field-control" value={user.name} readOnly /></div><div className="form-field"><label className="plain-label">Role</label><input className="field-control" value={user.role} readOnly /></div><div className="form-field"><label className="plain-label">Email</label><input className="field-control" value={user.email || 'admin@camps.edu'} readOnly /></div><div className="form-field"><label className="plain-label">Access scope</label><input className="field-control" value={user.department === 'ALL' ? 'All departments' : `${user.department} students only`} readOnly /></div></div></section></div>
}

function readLocalAdminTeachers() {
  if (typeof window === 'undefined') return demoTeachers.map((teacher) => ({ ...teacher }))
  try {
    const stored = JSON.parse(window.localStorage.getItem('camps_teachers') || 'null')
    if (Array.isArray(stored)) return stored
  } catch { /* use bundled demo teachers */ }
  return demoTeachers.map((teacher) => ({ ...teacher }))
}

function writeLocalAdminTeachers(teachers) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('camps_teachers', JSON.stringify(teachers))
}

function AdminPeopleView({ user, token, students, setStudents, onAddStudent, showToast }) {
  const navigate = useNavigate()
  const selectedDepartment = user.department === 'ALL' ? '' : user.department
  const apiSession = !DEMO_MODE && isApiToken(getAuthToken() || token)
  const [activeRole, setActiveRole] = useState('students')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 })
  const [loading, setLoading] = useState(false)
  const [teacherForm, setTeacherForm] = useState(null)
  const [parentForm, setParentForm] = useState(null)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const limit = 10
  const localParents = useMemo(() => students.filter((student) => student.parentName).map((student) => ({
    id: Number(student.id) === 4 ? 2 : 10000 + Number(student.id),
    studentId: student.id,
    studentName: student.name,
    studentUsn: student.usn,
    name: student.parentName,
    email: student.parentEmail || '',
    phone: student.parentPhone || '',
    relationship: 'Parent',
    department: student.department,
    semester: student.semester,
    isActive: student.isActive !== false,
  })), [students])
  const localTeachers = useMemo(() => readLocalAdminTeachers().filter((teacher) => !selectedDepartment || teacher.department === selectedDepartment), [selectedDepartment, reloadToken])

  useEffect(() => {
    setPage(1)
  }, [activeRole, status, query, selectedDepartment])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (!apiSession) {
          const source = activeRole === 'teachers' ? localTeachers : activeRole === 'parents' ? localParents : students
          const normalizedQuery = query.trim().toLowerCase()
          const filtered = source.filter((record) => {
            const active = record.isActive !== false
            const searchable = `${record.name || ''} ${record.email || ''} ${record.usn || ''} ${record.studentName || ''} ${record.studentUsn || ''} ${record.employeeCode || ''}`.toLowerCase()
            return (status === 'all' || (status === 'active' ? active : !active)) && (!normalizedQuery || searchable.includes(normalizedQuery))
          })
          const start = (page - 1) * limit
          if (mounted) {
            setRecords(filtered.slice(start, start + limit))
            setPagination({ page, limit, total: filtered.length, pages: Math.max(1, Math.ceil(filtered.length / limit)) })
          }
          return
        }
        const apiToken = getAuthToken() || token
        if (!isApiToken(apiToken)) throw new Error('Your secure session is unavailable. Please sign in again.')
        setAuthToken(apiToken)
        const params = { department: selectedDepartment || undefined, status, search: query.trim() || undefined, page, limit }
        const response = activeRole === 'teachers'
          ? await api.getTeachers(params)
          : activeRole === 'parents'
            ? await api.getParents(params)
            : await api.getStudents(params)
        if (mounted) {
          setRecords(response?.data || [])
          setPagination(response?.pagination || { page, limit, total: response?.data?.length || 0, pages: 1 })
        }
      } catch (loadError) {
        if (mounted) setError(loadError.response?.data?.message || loadError.message || 'People records could not be loaded.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [activeRole, apiSession, localParents, localTeachers, students, selectedDepartment, query, status, page, token, reloadToken])

  const refresh = () => setReloadToken((current) => current + 1)
  const openStudents = () => navigate('/app/students')
  const toggleStudentStatus = async (student) => {
    const nextStatus = student.isActive === false
    if (!window.confirm(`${nextStatus ? 'Activate' : 'Deactivate'} ${student.name}'s student account?`)) return
    try {
      if (apiSession) {
        setAuthToken(getAuthToken() || token)
        await api.updateStudentStatus(student.id, nextStatus)
      }
      setStudents?.((current) => current.map((item) => Number(item.id) === Number(student.id) ? { ...item, isActive: nextStatus } : item))
      showToast(`${student.name}'s account is now ${nextStatus ? 'active' : 'inactive'}`)
      refresh()
    } catch (statusError) {
      showToast(statusError.response?.data?.message || statusError.message || 'Student account status could not be changed.')
    }
  }

  const saveTeacher = async (input) => {
    const { password: enteredPassword, ...profile } = input
    const passwordHash = !apiSession && enteredPassword ? await hashLocalCredential(enteredPassword) : ''
    const localTeacher = { ...profile, id: input.id || Date.now(), isActive: input.isActive !== false, initials: input.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(), ...(passwordHash ? { passwordHash } : {}) }
    let saved = localTeacher
    if (apiSession) {
      const apiToken = getAuthToken() || token
      if (!isApiToken(apiToken)) throw new Error('Your secure session is unavailable. Please sign in again.')
      setAuthToken(apiToken)
      const response = input.id ? await api.updateTeacher(input.id, input) : await api.createTeacher(input)
      saved = response.data || localTeacher
    } else {
      const allTeachers = readLocalAdminTeachers().map(({ password: _legacyPassword, ...teacher }) => teacher)
      const nextAll = input.id
        ? allTeachers.map((teacher) => Number(teacher.id) === Number(input.id) ? { ...teacher, ...localTeacher } : teacher)
        : [...allTeachers.filter((teacher) => teacher.email !== localTeacher.email), localTeacher]
      writeLocalAdminTeachers(nextAll)
    }
    setTeacherForm(null)
    showToast(`${saved.name} was ${input.id ? 'updated' : 'added'}${saved.isActive === false ? ' and deactivated' : ''}.`)
    refresh()
  }

  const toggleTeacherStatus = async (teacher) => {
    const nextStatus = teacher.isActive === false
    if (!window.confirm(`${nextStatus ? 'Activate' : 'Deactivate'} ${teacher.name}'s account?`)) return
    try {
      if (apiSession) {
        setAuthToken(getAuthToken() || token)
        if (nextStatus) await api.updateTeacher(teacher.id, { isActive: true })
        else await api.deactivateTeacher(teacher.id)
      } else {
        const allTeachers = readLocalAdminTeachers().map((item) => Number(item.id) === Number(teacher.id) ? { ...item, isActive: nextStatus } : item)
        writeLocalAdminTeachers(allTeachers)
      }
      showToast(`${teacher.name}'s account is now ${nextStatus ? 'active' : 'inactive'}.`)
      refresh()
    } catch (statusError) {
      showToast(statusError.response?.data?.message || statusError.message || 'Teacher account status could not be changed.')
    }
  }

  const saveParent = async (input) => {
    if (!apiSession) {
      throw new Error('Parent account changes require the API-backed mode so credentials remain securely hashed.')
    }
    const apiToken = getAuthToken() || token
    if (!isApiToken(apiToken)) throw new Error('Your secure session is unavailable. Please sign in again.')
    setAuthToken(apiToken)
    const response = input.id ? await api.updateParent(input.id, input) : await api.createParent(input)
    setParentForm(null)
    showToast(`${input.name} was ${input.id ? 'updated' : 'added'} as a parent account.`)
    if (response?.data) setRecords((current) => input.id ? current.map((item) => Number(item.id) === Number(input.id) ? response.data : item) : [response.data, ...current])
    refresh()
  }

  const toggleParentStatus = async (parent) => {
    const nextStatus = parent.isActive === false
    if (!window.confirm(`${nextStatus ? 'Activate' : 'Deactivate'} ${parent.name}'s account?`)) return
    try {
      if (!apiSession) throw new Error('Parent account status changes require the API-backed mode so account state remains authoritative.')
      setAuthToken(getAuthToken() || token)
      if (nextStatus) await api.updateParent(parent.id, { isActive: true })
      else await api.deactivateParent(parent.id)
      showToast(`${parent.name}'s account is now ${nextStatus ? 'active' : 'inactive'}.`)
      refresh()
    } catch (statusError) {
      showToast(statusError.response?.data?.message || statusError.message || 'Parent account status could not be changed.')
    }
  }

  const roleLabel = activeRole === 'students' ? 'Student' : activeRole === 'teachers' ? 'Teacher' : 'Parent'
  return <div className="dashboard-content admin-people-page">
    <PageIntro eyebrow="Administration · People" title="People management" description="Search authorized student, teacher and parent accounts without exposing credentials or changing academic records." actions={<><button className="button-ghost" type="button" onClick={openStudents}><FiUsers /> Student records</button>{activeRole === 'students' && <button className="button-primary" type="button" onClick={onAddStudent}><FiPlus /> Add student</button>}{activeRole === 'teachers' && <button className="button-primary" type="button" onClick={() => setTeacherForm({})}><FiPlus /> Add teacher</button>}{activeRole === 'parents' && <button className="button-primary" type="button" onClick={() => setParentForm({})} disabled={!apiSession}><FiPlus /> Add parent</button>}</>} />
    <div className="semester-context-banner"><FiShield /><span>Role checks and department scope are enforced by the backend. Passwords are never displayed; parent account creation and status changes require an API-backed session.</span></div>
    <div className="admin-people-tabs" role="tablist" aria-label="People account type">{[['students', 'Students'], ['teachers', 'Teachers'], ['parents', 'Parents']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeRole === key} className={activeRole === key ? 'active' : ''} onClick={() => { setActiveRole(key); setPage(1) }}>{label}</button>)}</div>
    <div className="toolbar-card"><div className="search-field"><FiSearch /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={`Search ${roleLabel.toLowerCase()} accounts`} aria-label={`Search ${roleLabel.toLowerCase()} accounts`} /></div><div className="toolbar-filters"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Filter account status"><option value="active">Active accounts</option><option value="inactive">Inactive accounts</option><option value="all">All statuses</option></select><span className="scope-pill">{pagination.total} records</span></div></div>
    {error && <div className="dashboard-data-notice" role="alert"><FiAlertCircle /><span>{error}</span><button type="button" onClick={() => setPage((current) => current)}>Retry</button></div>}
    <section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">{roleLabel} accounts</h2><p className="card-description">{loading ? 'Loading authorized records…' : `${pagination.total} ${roleLabel.toLowerCase()} record${pagination.total === 1 ? '' : 's'} · page ${pagination.page} of ${pagination.pages}`}</p></div><span className="department-note"><FiShield /> {selectedDepartment || 'All departments'}</span></div>{loading ? <div className="empty-state"><FiRefreshCw className="dashboard-loading-icon" /><span>Loading records…</span></div> : records.length ? <div className="table-scroll"><table className="student-table admin-people-table"><thead><tr>{activeRole === 'students' ? <><th>Student</th><th>Department</th><th>Semester</th><th>Section</th><th>Academic status</th><th>Account</th><th>Actions</th></> : activeRole === 'teachers' ? <><th>Teacher</th><th>Department</th><th>Employee code</th><th>Contact</th><th>Account</th><th>Actions</th></> : <><th>Parent</th><th>Linked student</th><th>Contact</th><th>Relationship</th><th>Account</th><th>Actions</th></> }</tr></thead><tbody>{records.map((record) => { const active = record.isActive !== false; return <tr key={`${activeRole}-${record.id}`}><td><div className="student-cell"><Avatar initials={record.initials || String(record.name || '').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()} tone={active ? 'sky' : ''} /><div><span className="student-name">{record.name}</span><span className="student-usn">{activeRole === 'students' ? record.usn : record.email}</span></div></div></td>{activeRole === 'students' ? <><td>{record.department}</td><td>Semester {record.semester}</td><td>{record.section}</td><td><RiskBadge risk={record.risk} /></td><td><span className={`account-status ${active ? 'active' : 'inactive'}`}><i /> {active ? 'Active' : 'Inactive'}</span></td><td><button className="row-action" type="button" onClick={openStudents} aria-label={`Open ${record.name} in student records`}><FiEdit3 /></button><button className="row-action" type="button" onClick={() => toggleStudentStatus(record)} aria-label={`${active ? 'Deactivate' : 'Activate'} ${record.name}`}><FiTrash2 /></button></td></> : activeRole === 'teachers' ? <><td>{record.department}</td><td>{record.employeeCode}</td><td>{record.email}{record.phone ? ` · ${record.phone}` : ''}</td><td><span className={`account-status ${active ? 'active' : 'inactive'}`}><i /> {active ? 'Active' : 'Inactive'}</span></td><td><button className="row-action" type="button" onClick={() => setTeacherForm(record)} aria-label={`Edit ${record.name}`}><FiEdit3 /></button><button className="row-action" type="button" onClick={() => toggleTeacherStatus(record)} aria-label={`${active ? 'Deactivate' : 'Activate'} ${record.name}`}><FiTrash2 /></button></td></> : <><td>{record.studentName} · {record.studentUsn}</td><td>{record.email || 'Email not recorded'}{record.phone ? ` · ${record.phone}` : ''}</td><td>{record.relationship || 'Parent'}</td><td><span className={`account-status ${active ? 'active' : 'inactive'}`}><i /> {active ? 'Active' : 'Inactive'}</span></td><td><button className="row-action" type="button" onClick={() => setParentForm(record)} aria-label={`Edit ${record.name}`}><FiEdit3 /></button><button className="row-action" type="button" onClick={() => toggleParentStatus(record)} aria-label={`${active ? 'Deactivate' : 'Activate'} ${record.name}`}><FiTrash2 /></button></td></>}</tr> })}</tbody></table></div> : <div className="empty-state"><FiUsers /><span>No {roleLabel.toLowerCase()} records match the current filters.</span></div>}<div className="table-footer"><span>Showing {records.length ? (pagination.page - 1) * pagination.limit + 1 : 0}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span><div className="pagination"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} aria-label="Previous page">‹</button><span>{pagination.page} / {pagination.pages}</span><button type="button" onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} disabled={page >= pagination.pages} aria-label="Next page">›</button></div></div></section>
    {teacherForm && <TeacherForm teacher={teacherForm.id ? teacherForm : null} department={selectedDepartment} onClose={() => setTeacherForm(null)} onSave={saveTeacher} />}
    {parentForm && <ParentForm parent={parentForm.id ? parentForm : null} students={students.filter((student) => !selectedDepartment || student.department === selectedDepartment)} onClose={() => setParentForm(null)} onSave={saveParent} />}
  </div>
}

function TeacherForm({ teacher, department, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ employeeCode: teacher?.employeeCode || '', name: teacher?.name || '', email: teacher?.email || '', department: department || teacher?.department || 'CSE', designation: teacher?.designation || 'Assistant Professor', phone: teacher?.phone || '', password: '', isActive: teacher?.isActive !== false }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const update = (key, value) => { setError(''); setForm((current) => ({ ...current, [key]: value })) }
  const submit = async (event) => {
    event.preventDefault()
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/.test(form.employeeCode.trim())) { setError('Use an employee code with 3–30 letters, numbers or hyphens.'); return }
    if (!form.name.trim()) { setError('Teacher name is required.'); return }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { setError('Enter a valid teacher email address.'); return }
    if (!teacher && form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (teacher && form.password && form.password.length < 8) { setError('A new password must be at least 8 characters.'); return }
    setSaving(true)
    try { await onSave({ ...form, ...(form.password ? {} : { password: undefined }), ...(teacher ? { id: teacher.id } : {}), employeeCode: form.employeeCode.trim().toUpperCase(), name: form.name.trim(), email: form.email.trim().toLowerCase(), department: form.department.toUpperCase(), designation: form.designation.trim(), phone: form.phone.trim() }) } catch (saveError) { setError(saveError.message || 'Teacher account could not be saved.') } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal-card wide" onSubmit={submit}><div className="modal-head"><div><h2>{teacher ? 'Edit teacher account' : 'Add teacher account'}</h2><p>Credentials are hashed by the API and are never shown in this workspace.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field"><label className="plain-label">Employee code</label><input className="field-control" value={form.employeeCode} onChange={(event) => update('employeeCode', event.target.value.toUpperCase())} placeholder="FAC-CSE-002" required /></div><div className="form-field"><label className="plain-label">Teacher name</label><input className="field-control" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full name" required /></div><div className="form-field"><label className="plain-label">Email address</label><input className="field-control" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="teacher@pestrust.edu.in" required /></div><div className="form-field"><label className="plain-label">Department</label>{department ? <input className="field-control locked-field" value={department} readOnly /> : <select className="field-control" value={form.department} onChange={(event) => update('department', event.target.value)}>{departments.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select>}</div><div className="form-field"><label className="plain-label">Designation</label><input className="field-control" value={form.designation} onChange={(event) => update('designation', event.target.value)} placeholder="Assistant Professor" /></div><div className="form-field"><label className="plain-label">Phone number</label><input className="field-control" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91 98450 00000" /></div><div className="form-field"><label className="plain-label">{teacher ? 'Reset password (optional)' : 'Temporary password'}</label><input className="field-control" type="password" value={form.password} onChange={(event) => update('password', event.target.value)} minLength="8" required={!teacher} autoComplete="new-password" /></div><div className="form-field"><label className="plain-label">Account status</label><select className="field-control" value={form.isActive ? 'active' : 'inactive'} onChange={(event) => update('isActive', event.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>{error && <div className="validation-error" role="alert">{error}</div>}</div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button-primary" type="submit" disabled={saving}><FiCheck /> {saving ? 'Saving…' : teacher ? 'Save changes' : 'Create teacher account'}</button></div></form></div>
}

function ParentForm({ parent, students, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ studentId: parent?.studentId || students[0]?.id || '', name: parent?.name || '', email: parent?.email || '', phone: parent?.phone || '', relationship: parent?.relationship || 'Parent', password: '', isActive: parent?.isActive !== false }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const update = (key, value) => { setError(''); setForm((current) => ({ ...current, [key]: value })) }
  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) { setError('Parent name is required.'); return }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { setError('Enter a valid email address.'); return }
    if (form.phone && !/^\+?[0-9 ()-]{10,18}$/.test(form.phone)) { setError('Enter a valid phone number.'); return }
    if (!parent && (!form.password || form.password.length < 8)) { setError('Parent password must be at least 8 characters.'); return }
    if (parent && form.password && form.password.length < 8) { setError('A new password must be at least 8 characters.'); return }
    setSaving(true)
    try { await onSave({ ...form, ...(form.password ? {} : { password: undefined }), ...(parent ? { id: parent.id } : {}), studentId: Number(form.studentId), name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), relationship: form.relationship.trim() }) } catch (saveError) { setError(saveError.message || 'Parent account could not be saved.') } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal-card wide" onSubmit={submit}><div className="modal-head"><div><h2>{parent ? 'Edit parent account' : 'Add parent account'}</h2><p>Link the account to an authorized student. Passwords are hashed by the API.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field full"><label className="plain-label">Linked student</label>{parent ? <input className="field-control locked-field" value={`${parent.studentName} · ${parent.studentUsn}`} readOnly /> : <select className="field-control" value={form.studentId} onChange={(event) => update('studentId', event.target.value)} required><option value="">Choose a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.usn}</option>)}</select>}</div><div className="form-field"><label className="plain-label">Parent name</label><input className="field-control" value={form.name} onChange={(event) => update('name', event.target.value)} required /></div><div className="form-field"><label className="plain-label">Relationship</label><input className="field-control" value={form.relationship} onChange={(event) => update('relationship', event.target.value)} maxLength="30" /></div><div className="form-field"><label className="plain-label">Email</label><input className="field-control" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></div><div className="form-field"><label className="plain-label">Phone</label><input className="field-control" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></div><div className="form-field"><label className="plain-label">{parent ? 'Reset password (optional)' : 'Password'}</label><input className="field-control" type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required={!parent} minLength="8" autoComplete="new-password" /></div><div className="form-field"><label className="plain-label">Account status</label><select className="field-control" value={form.isActive ? 'active' : 'inactive'} onChange={(event) => update('isActive', event.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>{error && <div className="validation-error" role="alert">{error}</div>}</div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button-primary" type="submit" disabled={saving}><FiCheck /> {saving ? 'Saving…' : parent ? 'Save changes' : 'Create parent account'}</button></div></form></div>
}

function StudentFormModal({ student, departmentScope = '', existingStudents = [], onClose, onSave }) {
  const defaultDepartment = departmentScope || student?.department || 'CSE'
  const [form, setForm] = useState(() => student ? { ...student, department: departmentScope || student.department, ...academicFields(student) } : { usn: '', name: '', department: defaultDepartment, semester: 7, section: 'A', gender: 'Female', email: '', phone: '', parentName: '', parentPhone: '', ...academicFields({ attendancePercentage: 75, averageInternalMarks: 60, averageAssignmentScore: 75, previousGpa: 7, currentGpa: 7, participationScore: 60 }) })
  const [error, setError] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    if (!form.usn || !form.name || !form.email) { setError('USN, name and email are required.'); return }
    if (existingStudents.some((item) => item.usn.toUpperCase() === form.usn.toUpperCase() && item.id !== form.id)) { setError('This USN already exists in the roster.'); return }
    if (departmentScope && form.department !== departmentScope) { setError(`This account is scoped to ${departmentScope}.`); return }
    if (form.phone && !/^\+?[0-9 ()-]{10,18}$/.test(form.phone)) { setError('Enter a valid phone number.'); return }
    const academic = academicFields(form)
    const invalid = ACADEMIC_ATTRIBUTES.find(({ key, min, max }) => academic[key] < min || academic[key] > max)
    if (invalid) { setError(`${invalid.label} must be between ${invalid.min} and ${invalid.max}.`); return }
    setError('')
    const saved = await onSave({ ...form, ...academic, ...predictAcademic(academic), id: form.id || Date.now(), semester: Number(form.semester), usn: form.usn.toUpperCase(), initials: form.initials || form.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase() })
    if (saved === false) setError('The student was not saved. Review the message above and try again.')
  }
  return <div className="modal-backdrop"><form className="modal-card wide" onSubmit={submit}><div className="modal-head"><div><h2>{student ? 'Edit student record' : 'Add a student'}</h2><p>Capture roster details and the teacher-entered academic performance.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field"><label className="plain-label">USN</label><input className="field-control" value={form.usn} onChange={(event) => update('usn', event.target.value.toUpperCase())} placeholder="4PM25CS101" required /></div><div className="form-field"><label className="plain-label">Student name</label><input className="field-control" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full name" required /></div><div className="form-field"><label className="plain-label">Department</label>{departmentScope ? <input className="field-control locked-field" value={departmentScope} readOnly /> : <select className="field-control" value={form.department} onChange={(event) => update('department', event.target.value)}><option>CSE</option><option>AIML</option><option>CSDS</option><option>CE</option><option>ECE</option><option>EEE</option><option>ME</option><option>CIVIL</option></select>}</div><div className="form-field"><label className="plain-label">Semester</label><select className="field-control" value={form.semester} onChange={(event) => update('semester', event.target.value)}>{semesters.map((item) => <option key={item}>{item}</option>)}</select></div><div className="form-field"><label className="plain-label">Section</label><select className="field-control" value={form.section} onChange={(event) => update('section', event.target.value)}><option>A</option><option>B</option><option>C</option><option>D</option></select></div><div className="form-field"><label className="plain-label">Gender</label><select className="field-control" value={form.gender} onChange={(event) => update('gender', event.target.value)}><option>Female</option><option>Male</option><option>Other</option></select></div><div className="form-field"><label className="plain-label">Email</label><input className="field-control" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="student@pestrust.edu.in" required /></div><div className="form-field"><label className="plain-label">Phone</label><input className="field-control" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91 98XXX XXXXX" /></div><div className="form-field"><label className="plain-label">Parent name</label><input className="field-control" value={form.parentName} onChange={(event) => update('parentName', event.target.value)} placeholder="Parent / guardian name" /></div><div className="form-field"><label className="plain-label">Parent phone</label><input className="field-control" value={form.parentPhone} onChange={(event) => update('parentPhone', event.target.value)} placeholder="+91 98XXX XXXXX" /></div></div><div className="profile-card-heading add-form-section-heading"><div><h2>Average Academic Performance</h2><p>These six attributes are entered directly by the teacher and stored on the student record.</p></div><FiActivity /></div><div className="form-grid">{ACADEMIC_ATTRIBUTES.map(({ key, label, suffix, min, max, step }) => <div className="form-field" key={key}><label className="plain-label">{label}</label><div className="academic-input-wrap"><input className="field-control" type="number" min={min} max={max} step={step} value={form[key]} onChange={(event) => update(key, event.target.value)} required /><small>{suffix}</small></div></div>)}</div>{error && <div className="validation-error">{error}</div>}</div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit"><FiCheck /> {student ? 'Save changes' : 'Save student'}</button></div></form></div>
}

function StudentDetailModal({ student, remarks = [], achievements = [], subjects = [], onClose }) {
  const academic = academicFields(student)
  const studentRemarks = remarks.filter((remark) => Number(remark.studentId) === Number(student.id))
  const studentAchievements = achievements.filter((achievement) => Number(achievement.studentId) === Number(student.id) || achievement.usn === student.usn)
  const studentSubjects = subjects.filter((subject) => subject.department === student.department && Number(subject.semester) === Number(student.semester))
  const outcome = student.result || predictAcademic(academic).result
  const risk = student.risk || predictAcademic(academic).risk
  return <div className="modal-backdrop"><div className="modal-card wide"><div className="modal-head"><div><h2>Average Academic Performance</h2><p>{student.name} · {student.department} · Semester {student.semester}</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="student-detail-hero"><Avatar initials={student.initials} tone="mint" /><div><h2>{student.name}</h2><p>{student.usn} · Section {student.section} · {student.email}</p></div><span style={{ marginLeft: 'auto' }}><RiskBadge risk={risk} /></span></div><div className="profile-stat-grid academic-performance-grid" style={{ marginTop: 18 }}>{ACADEMIC_ATTRIBUTES.map(({ key, label, suffix }) => <div key={key}><span>{label}</span><strong>{Number(academic[key]).toFixed(1)}</strong><small>{suffix}</small></div>)}</div><div className="detail-list" style={{ marginTop: 18 }}><div className="detail-item"><span>Prediction</span><strong>{outcome}</strong></div><div className="detail-item"><span>Risk level</span><strong>{risk}</strong></div><div className="detail-item"><span>Parent / guardian</span><strong>{student.parentName || 'Not recorded'}</strong></div><div className="detail-item"><span>Parent phone</span><strong>{student.parentPhone || 'Not recorded'}</strong></div></div></div><div className="modal-foot"><ReportCardDownloadButton studentId={student.id} usn={student.usn} scope={{ department: student.department, semester: student.semester, section: student.section }} reportData={{ student, subjects: studentSubjects, remarks: studentRemarks, achievements: studentAchievements }} /><button className="button-primary" type="button" onClick={onClose}>Done</button></div></div></div>
}

function UploadModal({ departmentScope = '', existingStudents = [], onClose, onImport, onPreview }) {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [fileError, setFileError] = useState('')
  const [previewNotice, setPreviewNotice] = useState('')
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [serverSummary, setServerSummary] = useState(null)

  const mergeServerPreview = (localRows, result) => {
    if (!result?.preview?.length) return
    const serverRows = new Map(result.preview.map((row, index) => [Number(row.rowNumber || index + 2), row]))
    setRows(localRows.map((row) => {
      const serverRow = serverRows.get(row.rowNumber)
      return serverRow ? { ...row, ...serverRow, id: row.id, rowNumber: row.rowNumber } : row
    }))
    if (result.summary) setServerSummary(result.summary)
  }

  const readFile = (selectedFile) => {
    setFile(selectedFile)
    setRows([])
    setFileError('')
    setPreviewNotice('')
    setServerSummary(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : []
        const localRows = normalizeImportRows(rawRows, { department: departmentScope }, existingStudents)
        setRows(localRows)
        if (onPreview) {
          setValidating(true)
          Promise.resolve(onPreview(selectedFile))
            .then((result) => {
              if (result) mergeServerPreview(localRows, result)
              else setPreviewNotice('Showing local validation. The server preview was unavailable; the upload will be checked again before import.')
            })
            .catch(() => setPreviewNotice('Showing local validation. The server preview was unavailable; the upload will be checked again before import.'))
            .finally(() => setValidating(false))
        }
      } catch {
        setRows([])
        setFileError('This file could not be read. Please upload a valid .xlsx, .xls or .csv file.')
      }
    }
    reader.onerror = () => setFileError('The spreadsheet could not be opened. Please try again.')
    reader.readAsArrayBuffer(selectedFile)
  }

  const importRows = async () => {
    if (!rows.some((row) => row.ready) || validating || importing) return
    setImporting(true)
    const saved = await onImport(rows, file)
    setImporting(false)
    if (saved !== false) onClose()
  }

  const summary = serverSummary || importSummary(rows)
  const issueRows = rows.filter((row) => row.issues?.length)
  return <div className="modal-backdrop"><div className="modal-card wide"><div className="modal-head"><div><h2>Upload students</h2><p>Preview every row, keep the department scope locked and import only valid, non-duplicate records.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body">{!file ? <div className="dropzone"><FiUploadCloud /><div><strong>Drop your roster here</strong><span>Accepted formats: .xlsx, .xls and .csv · Required columns include USN, Name, Email and six academic attributes</span><label htmlFor="roster-file">Choose Excel or CSV file<input id="roster-file" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /></label></div></div> : <><div className="upload-summary"><span><FiFileText style={{ verticalAlign: 'middle', marginRight: 6 }} /> {file.name}</span><strong>{validating ? 'Checking with server…' : `${rows.length} records found`}</strong></div>{fileError && <div className="validation-error">{fileError}</div>}{previewNotice && <div className="upload-preview-notice"><FiAlertCircle /> {previewNotice}</div>}{rows.length > 0 && <><div className="import-summary-grid"><div className="import-summary-card"><span>Total records</span><strong>{summary.total}</strong></div><div className="import-summary-card scope-match"><span>Match department</span><strong>{summary.matching}</strong></div><div className="import-summary-card ready"><span>Ready to import</span><strong>{summary.ready}</strong></div><div className="import-summary-card warning"><span>Skipped</span><strong>{summary.skipped}</strong></div><div className="import-summary-card error"><span>Validation issues</span><strong>{summary.invalid}</strong></div></div><div className={`import-summary-message ${summary.skipped ? 'warning' : 'success'}`}><FiAlertCircle /> {summary.ready ? `${summary.matching} records match this department. ${summary.ready} are ready to import; ${summary.skipped} will be skipped.` : 'No rows are ready to import. Review the highlighted rows before choosing another file.'}</div>{issueRows.length > 0 && <div className="validation-error import-validation-list"><strong>Review highlighted rows before import:</strong>{issueRows.slice(0, 6).map((row) => <div key={row.id}>Row {row.rowNumber}: {row.issues.join(' ')}</div>)}{issueRows.length > 6 && <div>+ {issueRows.length - 6} more rows with issues</div>}</div>}<div className="table-scroll" style={{ marginTop: 14, border: '1px solid #e9e8e2', borderRadius: 9 }}><table className="student-table" style={{ minWidth: 1020 }}><thead><tr><th>Row</th><th>USN</th><th>Name</th><th>Department</th><th>Semester</th><th>Section</th><th>Status</th><th>Details</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={`import-preview-row ${row.status}`}><td>{row.rowNumber}</td><td>{row.usn || '—'}</td><td>{row.name || '—'}</td><td>{row.department || '—'}</td><td>{row.semester || '—'}</td><td>{row.section || '—'}</td><td><span className={`import-status ${row.status}`}><i /> {importStatusLabel(row.status)}</span></td><td className="import-row-details">{row.issues?.length ? row.issues.join(' ') : 'Ready for import'}</td></tr>)}</tbody></table></div></>}</>}</div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button>{file && <button className="button-ghost" type="button" onClick={() => { setFile(null); setRows([]); setFileError(''); setPreviewNotice(''); setServerSummary(null) }}>Choose another</button>}<button className="button-primary" type="button" disabled={!rows.some((row) => row.ready) || validating || importing} onClick={importRows}><FiCheck /> {importing ? 'Importing…' : `Import ${summary.ready || ''} matching student${summary.ready === 1 ? '' : 's'}`}</button></div></div></div>
}

function MessageModal({ user, students = [], onClose, onSend }) {
  const availableStudents = students.filter((student) => !user.department || user.department === 'ALL' || student.department === user.department)
  const [form, setForm] = useState({ recipientRole: 'parent', studentId: availableStudents[0]?.id || '', subject: '', body: '' })
  const selectedStudent = availableStudents.find((student) => String(student.id) === String(form.studentId))
  const send = async (event) => {
    event.preventDefault()
    if (!selectedStudent || !form.subject.trim() || !form.body.trim()) return
    const recipientId = form.recipientRole === 'parent' ? (selectedStudent.parentId || selectedStudent.parent_id || (Number(selectedStudent.id) === 4 ? 2 : 10000 + Number(selectedStudent.id))) : selectedStudent.id
    await onSend({ recipientRole: form.recipientRole, ...(form.recipientRole === 'parent' && !selectedStudent.parentId && !selectedStudent.parent_id ? { demoRecipientId: Number(recipientId) } : { recipientId: Number(recipientId) }), recipient: form.recipientRole === 'parent' ? (selectedStudent.parentName || `${selectedStudent.name} Parent`) : selectedStudent.name, audience: form.recipientRole === 'parent' ? 'Parent' : 'Student', studentId: Number(selectedStudent.id), studentName: selectedStudent.name, subject: form.subject.trim(), body: form.body.trim(), department: selectedStudent.department, semester: Number(selectedStudent.semester), section: selectedStudent.section })
  }
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={send}><div className="modal-head"><div><h2>New direct message</h2><p>Send only to the selected student or that student’s parent.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field"><label className="plain-label">Recipient type</label><select className="field-control" value={form.recipientRole} onChange={(event) => setForm({ ...form, recipientRole: event.target.value })}><option value="parent">Parent of selected student</option><option value="student">Selected student</option></select></div><div className="form-field"><label className="plain-label">Student / family</label><select className="field-control" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} required><option value="">Choose a student</option>{availableStudents.map((student) => <option value={student.id} key={student.id}>{form.recipientRole === 'parent' ? `${student.parentName || `${student.name} Parent`} · ${student.name}` : `${student.name} · ${student.usn}`}</option>)}</select></div><div className="form-field full"><label className="plain-label">Subject</label><input className="field-control" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="What would you like them to know?" maxLength="180" required /></div><div className="form-field full"><label className="plain-label">Message</label><textarea className="field-control" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write with clarity and care…" maxLength="10000" required /></div></div></div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit" disabled={!selectedStudent}><FiSend /> Send message</button></div></form></div>
}

function AnnouncementModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', body: '', type: 'Department', department: 'CSE', semester: 7, priority: 'Normal' })
  const create = (event) => { event.preventDefault(); if (!form.title || !form.body) return; onCreate(form) }
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={create}><div className="modal-head"><div><h2>Create announcement</h2><p>Choose an audience and make the next step visible.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field full"><label className="plain-label">Title</label><input className="field-control" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Project review tomorrow" required /></div><div className="form-field"><label className="plain-label">Visibility</label><select className="field-control" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>College</option><option>Department</option><option>Semester</option></select></div><div className="form-field"><label className="plain-label">Priority</label><select className="field-control" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Normal</option><option>Medium</option><option>High</option></select></div>{form.type !== 'College' && <div className="form-field"><label className="plain-label">Department</label><select className="field-control" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}><option>CSE</option><option>AIML</option><option>CSDS</option><option>CE</option><option>ECE</option></select></div>}{form.type === 'Semester' && <div className="form-field"><label className="plain-label">Semester</label><select className="field-control" value={form.semester} onChange={(event) => setForm({ ...form, semester: Number(event.target.value) })}>{semesters.map((item) => <option key={item}>{item}</option>)}</select></div>}<div className="form-field full"><label className="plain-label">Message</label><textarea className="field-control" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write the announcement details…" required /></div></div></div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit"><FiBell /> Publish announcement</button></div></form></div>
}

function RemarkModal({ students, onClose, onCreate }) {
  const [form, setForm] = useState({ studentId: students[0]?.id || '', label: 'Needs Improvement', note: '' })
  const save = (event) => { event.preventDefault(); if (!form.note) return; onCreate(form) }
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={save}><div className="modal-head"><div><h2>Add teacher remark</h2><p>Your context will be visible to the student and parent.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field full"><label className="plain-label">Student</label><select className="field-control" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>{students.filter((student) => student.department === 'CSE').map((student) => <option value={student.id} key={student.id}>{student.name} · {student.usn}</option>)}</select></div><div className="form-field full"><label className="plain-label">Remark type</label><select className="field-control" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })}><option>Excellent Performance</option><option>Needs Improvement</option><option>Good Participation</option><option>Low Attendance</option><option>Outstanding Student</option></select></div><div className="form-field full"><label className="plain-label">Observation</label><textarea className="field-control" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Add one specific, useful next step…" required /></div></div></div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit"><FiCheck /> Save remark</button></div></form></div>
}

export default function Dashboard() {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationView = location.pathname.startsWith('/app/') ? location.pathname.slice('/app/'.length).split('/')[0] || 'overview' : 'overview'
  const [activeView, setActiveView] = useState(locationView)
  const isLearner = user.role === 'student' || user.role === 'parent'
  const useRemoteData = !DEMO_MODE && isApiToken(token)
  const [students, setStudents] = useState(() => useRemoteData ? [] : cloneDemoStudents())
  const demoInbox = getDemoMessages().filter((item) => ['teacher', 'admin'].includes(user.role) || (Number(item.receiverId) === Number(user.id) && item.receiverRole === user.role) || String(item.recipient || '').toLowerCase().includes(String(user.name || '').toLowerCase()))
  const [messages, setMessages] = useState(() => useRemoteData ? [] : demoInbox.map((item) => ({ ...item })))
  const [unreadCount, setUnreadCount] = useState(() => useRemoteData ? 0 : demoInbox.filter((item) => !item.read && (item.senderRole ? item.senderRole !== user.role : item.sender !== user.name)).length)
  const [announcements, setAnnouncements] = useState(() => useRemoteData ? [] : demoAnnouncements.map((item) => ({ ...item })))
  const [remarks, setRemarks] = useState(() => useRemoteData ? [] : demoRemarks.map((item) => ({ ...item })))
  const [achievements, setAchievements] = useState(() => useRemoteData ? [] : demoAchievements.map((item) => ({ ...item })))
  const [subjects, setSubjects] = useState(() => useRemoteData ? [] : getDemoSubjects())
  const [dashboardLoading, setDashboardLoading] = useState(useRemoteData)
  const [dashboardError, setDashboardError] = useState('')
  const [adminSummary, setAdminSummary] = useState(null)
  const [adminSummaryError, setAdminSummaryError] = useState('')
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setActiveView(locationView)
  }, [locationView])

  useEffect(() => {
    if (DEMO_MODE || !user) {
      setDashboardLoading(false)
      return undefined
    }
    let mounted = true
    setDashboardLoading(useRemoteData)
    setDashboardError('')
    const requests = [
      ['students', api.getStudents({ limit: 100 })],
      ['messages', api.getMessages()],
      ['announcements', api.getAnnouncements()],
      ['remarks', api.getRemarks()],
      ['achievements', api.getAchievements()],
      ['subjects', api.getSubjects()],
    ]
    console.info('[dashboard] Fetching dashboard data.', { role: user.role, userId: user.id, usn: user.usn, studentId: user.studentId, department: user.department, semester: user.semester })
    Promise.allSettled(requests.map(([, request]) => request)).then(async (results) => {
      if (!mounted) return
      const [studentResult, messageResult, announcementResult, remarkResult, achievementResult, subjectResult] = results
      const labels = requests.map(([label]) => label)
      const failures = results.map((result, index) => result.status === 'rejected' ? { endpoint: labels[index], status: result.reason?.response?.status || 'network', message: result.reason?.response?.data?.message || result.reason?.message } : null).filter(Boolean)
      if (failures.length) console.error('[dashboard] One or more dashboard requests failed.', { role: user.role, failures })
      const authFailure = failures.find((failure) => failure.status === 401)
      if (authFailure) {
        console.error('[dashboard] Session rejected by API; returning to login.', { endpoint: authFailure.endpoint, status: authFailure.status, role: user.role })
        await logout()
        if (mounted) navigate(`/login?department=${encodeURIComponent(user.department || '')}&role=${user.role}&reason=session`, { replace: true })
        return
      }
      if (studentResult.status === 'fulfilled' && studentResult.value?.data) setStudents(studentResult.value.data)
      if (messageResult.status === 'fulfilled' && messageResult.value) {
        const nextMessages = messageResult.value.data || []
        setMessages(nextMessages)
        setUnreadCount(Number(messageResult.value.unreadCount ?? nextMessages.filter((message) => !message.read && (message.senderRole ? message.senderRole !== user.role : message.sender !== user.name)).length))
      }
      if (announcementResult.status === 'fulfilled' && announcementResult.value?.data) setAnnouncements(announcementResult.value.data)
      if (remarkResult.status === 'fulfilled' && remarkResult.value?.data) setRemarks(remarkResult.value.data)
      if (achievementResult.status === 'fulfilled' && achievementResult.value?.data) setAchievements(achievementResult.value.data)
      if (subjectResult.status === 'fulfilled' && subjectResult.value?.data) setSubjects(subjectResult.value.data)
      const studentRows = studentResult.status === 'fulfilled' ? studentResult.value?.data || [] : []
      if (isLearner && !studentRows.length && isApiToken(token)) setDashboardError(studentResult.status === 'rejected' ? 'Your student record could not be loaded. Check the API connection and try again.' : 'No active student record is linked to this account. Please contact the academic office.')
      else if (failures.length && !isApiToken(token)) setDashboardError('The live API is unavailable. Showing the saved review data for this session.')
      else if (failures.length) setDashboardError(`Some dashboard data could not be loaded (${failures.map((failure) => failure.endpoint).join(', ')}). The available information is shown below.`)
      console.info('[dashboard] Dashboard data fetch completed.', { role: user.role, studentRecords: studentRows.length, messages: messageResult.status === 'fulfilled' ? (messageResult.value?.data || []).length : 0, failures: failures.length })
      setDashboardLoading(false)
    })
    return () => { mounted = false }
  }, [user, token, dashboardRefreshKey])

  useEffect(() => {
    if (DEMO_MODE || !user || user.role !== 'admin' || !isApiToken(token)) {
      setAdminSummary(null)
      setAdminSummaryError('')
      return undefined
    }
    let mounted = true
    setAdminSummaryError('')
    api.getAdminSummary().then((response) => {
      if (mounted) setAdminSummary(response?.data || null)
    }).catch((error) => {
      if (mounted) setAdminSummaryError(error.response?.data?.message || error.message || 'The administration summary could not be loaded.')
    })
    return () => { mounted = false }
  }, [user, token, dashboardRefreshKey])

  useEffect(() => {
    if (!DEMO_MODE) return undefined
    const syncSubjects = () => setSubjects(getDemoSubjects())
    const syncMessages = () => setMessages(getDemoMessages().filter((item) => ['teacher', 'admin'].includes(user.role) || (Number(item.receiverId) === Number(user.id) && item.receiverRole === user.role) || String(item.recipient || '').toLowerCase().includes(String(user.name || '').toLowerCase())))
    window.addEventListener('storage', syncSubjects)
    window.addEventListener('camps-subjects-updated', syncSubjects)
    window.addEventListener('storage', syncMessages)
    window.addEventListener('camps-messages-updated', syncMessages)
    return () => { window.removeEventListener('storage', syncSubjects); window.removeEventListener('camps-subjects-updated', syncSubjects); window.removeEventListener('storage', syncMessages); window.removeEventListener('camps-messages-updated', syncMessages) }
  }, [user])

  useEffect(() => {
    if (DEMO_MODE || !user) return undefined
    let mounted = true
    const refreshMessages = async () => {
      try {
        const response = await api.getMessages()
        if (!mounted) return
        const nextMessages = response?.data || []
        setMessages(nextMessages)
        setUnreadCount(Number(response?.unreadCount ?? nextMessages.filter((message) => !message.read && (message.senderRole ? message.senderRole !== user.role : message.sender !== user.name)).length))
      } catch (error) {
        console.warn('[messages] Inbox refresh failed.', { status: error.response?.status || 'network', message: error.response?.data?.message || error.message })
      }
    }
    const interval = window.setInterval(refreshMessages, 10000)
    window.addEventListener('camps-messages-updated', refreshMessages)
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener('camps-messages-updated', refreshMessages) }
  }, [user])

  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3000) }
  const exportStudents = () => { const departmentScope = user.department === 'ALL' ? '' : user.department; const visibleStudents = departmentScope ? students.filter((student) => student.department === departmentScope) : students; const rows = visibleStudents.map((student) => ({ USN: student.usn, Name: student.name, Department: student.department, Semester: student.semester, Section: student.section, Gender: student.gender || '', Email: student.email, Phone: student.phone || '', 'Parent Name': student.parentName || '', 'Parent Phone': student.parentPhone || '', 'Attendance Percentage': student.attendancePercentage, 'Average Internal Marks': student.averageInternalMarks, 'Average Assignment Score': student.averageAssignmentScore, 'Previous GPA': student.previousGpa, 'Current GPA': student.currentGpa, 'Participation Score': student.participationScore, Result: student.result || predictAcademic(student).result, Risk: student.risk || predictAcademic(student).risk })); const worksheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Students'); XLSX.writeFile(workbook, 'camps-student-roster.xlsx'); showToast('Roster exported as camps-student-roster.xlsx') }
  const previewImportedStudents = async (file) => {
    if (DEMO_MODE) return null
    const activeToken = getAuthToken() || token
    if (!isApiToken(activeToken)) {
      showToast('Your secure session is unavailable. Please sign in again before importing students.')
      return null
    }
    const departmentScope = user.department === 'ALL' ? '' : user.department
    try {
      setAuthToken(activeToken)
      return await api.uploadStudents(file, false, departmentScope ? { department: departmentScope } : {})
    } catch (error) {
      console.warn('[students-import] Dashboard server preview failed.', { status: error.response?.status || 'network', message: error.response?.data?.message || error.message })
      return null
    }
  }
  const importStudents = async (rows, file) => {
    const departmentScope = user.department === 'ALL' ? '' : user.department
    const activeToken = getAuthToken() || token
    if (!DEMO_MODE && !isApiToken(activeToken)) {
      console.error('[students-import] Refusing to import without an API authentication token.', { role: user.role, department: user.department })
      showToast('Your secure session is unavailable. Please sign in again before importing students.')
      return false
    }
    const readyRows = rows.filter((row) => row.ready)
    const localRecords = readyRows.map((row, index) => { const academic = academicFields(row); return { ...row, department: String(row.department).toUpperCase(), ...academic, ...predictAcademic(academic), id: Date.now() + index, semester: Number(row.semester), initials: row.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase() } })
    let savedRows = localRecords
    let summary = importSummary(rows)
    let refreshed = false
    if (!DEMO_MODE) {
      try {
        setAuthToken(activeToken)
        const response = await api.uploadStudents(file, true, departmentScope ? { department: departmentScope } : {})
        savedRows = response.data || []
        summary = response.summary || { ...summary, imported: savedRows.length }
        try {
          const refreshedResponse = await api.getStudents({ ...(departmentScope ? { department: departmentScope } : {}), limit: 100 })
          if (refreshedResponse.data) { setStudents(refreshedResponse.data); refreshed = true }
        } catch (refreshError) {
          console.warn('[students-import] Dashboard roster refresh failed after import.', { status: refreshError.response?.status, message: refreshError.message })
        }
      } catch (error) {
        console.error('[students-import] Dashboard import failed.', { status: error.response?.status || 'network', message: error.response?.data?.message || error.message })
        if (error.response?.status === 401) {
          await logout()
          navigate(`/login?department=${encodeURIComponent(user.department)}&role=${user.role}&reason=session`, { replace: true })
        } else showToast(error.response?.data?.errors?.slice(0, 3).join(' ') || error.response?.data?.message || 'The student import could not be completed.')
        return false
      }
    }
    if (!refreshed) setStudents((current) => [...savedRows, ...current])
    const imported = Number(summary.imported ?? savedRows.length)
    const skipped = Number(summary.skipped ?? Math.max(0, rows.length - imported))
    showToast(`${imported} student${imported === 1 ? '' : 's'} imported successfully${skipped ? `. ${skipped} skipped${summary.outOfScope ? ` because they belong to a different department` : ''}.` : '.'}`)
    return true
  }
  const saveNewStudent = async (student) => {
    const departmentScope = user.department === 'ALL' ? '' : user.department
    if (departmentScope && student.department !== departmentScope) { showToast(`Save blocked · this account is scoped to ${departmentScope}`); return false }
    const academic = academicFields(student)
    let saved = { ...student, department: String(student.department).toUpperCase(), ...academic, ...predictAcademic(academic) }
    let refreshed = false
    if (!DEMO_MODE) {
      const activeToken = getAuthToken() || token
      if (!isApiToken(activeToken)) {
        console.error('[students] Refusing to submit without an API authentication token.', { role: user.role, department: user.department })
        showToast('Your secure session is unavailable. Please sign in again before saving to the database.')
        return false
      }
      try {
        setAuthToken(activeToken)
        const response = await api.createStudent(saved, activeToken)
        saved = response.data || saved
        try {
          const refreshedResponse = await api.getStudents({ limit: 100 })
          if (refreshedResponse.data) { setStudents(refreshedResponse.data); refreshed = true }
        } catch (refreshError) {
          console.warn('[students] Student was created, but the roster refresh failed.', { message: refreshError.message, status: refreshError.response?.status })
        }
      } catch (error) {
        console.error('[students] Student creation failed.', { status: error.response?.status || 'network', message: error.response?.data?.message || error.message, department: saved.department, semester: saved.semester, section: saved.section })
        if (error.response?.status === 401) {
          await logout()
          navigate(`/login?department=${encodeURIComponent(user.department)}&role=${user.role}&reason=session`, { replace: true })
          return false
        }
        if (error.response) { showToast(error.response.data?.errors?.join(' ') || error.response.data?.message || 'Student could not be saved'); return false }
        showToast('API unavailable · student was not saved to the database')
        return false
      }
    }
    if (!refreshed) setStudents((current) => [saved, ...current])
    setStudentModalOpen(false)
    showToast('Student saved successfully')
    return true
  }
  const navigateView = (view, item) => {
    if (view === 'subjects' && user.role === 'admin') {
      navigate('/admin/subjects')
      return
    }
    if (view === 'student' && user.role === 'teacher' && item?.usn) {
      navigate(`/teacher/student/${encodeURIComponent(item.usn)}?semester=${item.semester}&section=${encodeURIComponent(item.section)}`)
      return
    }
    setActiveView(view)
    const target = view === 'overview' ? '/app' : `/app/${view}`
    if (location.pathname !== target) navigate(target)
  }
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }

  const renderContent = () => {
    if (activeView === 'profile') return <ProfileView user={user} />
    if (activeView === 'settings') return <SettingsView user={user} showToast={showToast} />
    if (user.role === 'student' || user.role === 'parent') {
      if (activeView === 'records') return <RecordsView user={user} students={students} achievements={achievements} subjects={subjects} onNavigate={navigateView} />
      if (activeView === 'achievements') return <AchievementsView user={user} students={students} achievements={achievements} onNavigate={navigateView} />
      if (activeView === 'messages') return <ChatView user={user} students={students} initialMessages={messages} department={user.department} semester={user.semester} apiSession={!DEMO_MODE && isApiToken(token)} notify={showToast} onUnreadCountChange={setUnreadCount} />
      if (activeView === 'announcements') return <AnnouncementsView announcements={announcements} setAnnouncements={setAnnouncements} user={user} showToast={showToast} readOnly />
      return <LearnerOverview user={user} students={students} announcements={announcements} messages={messages} remarks={remarks} achievements={achievements} subjects={subjects} onNavigate={navigateView} />
    }
    if (activeView === 'students') return <StudentsView user={user} students={students} setStudents={setStudents} onAddStudent={() => setStudentModalOpen(true)} onUpload={() => setUploadOpen(true)} onExport={exportStudents} showToast={showToast} selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent} remarks={remarks} achievements={achievements} subjects={subjects} />
    if (user.role === 'admin' && activeView === 'reports') return <AdminReportsView user={user} students={students} />
    if (['teacher', 'admin'].includes(user.role) && activeView === 'evaluation') return <ModelEvaluation apiSession={!DEMO_MODE && isApiToken(getAuthToken() || token)} department={user.department === 'ALL' ? '' : user.department} />
    if (activeView === 'prediction') return <PredictionView user={user} students={students} showToast={showToast} apiSession={!DEMO_MODE && isApiToken(getAuthToken() || token)} />
    if (user.role === 'admin' && activeView === 'people') return <AdminPeopleView user={user} token={token} students={students} setStudents={setStudents} onAddStudent={() => setStudentModalOpen(true)} showToast={showToast} />
    if (activeView === 'messages') return <ChatView user={user} students={students} initialMessages={messages} department={user.department === 'ALL' ? '' : user.department} semester={user.semester} apiSession={!DEMO_MODE && isApiToken(token)} notify={showToast} onUnreadCountChange={setUnreadCount} />
    if (activeView === 'announcements') return <AnnouncementsView announcements={announcements} setAnnouncements={setAnnouncements} user={user} showToast={showToast} />
    if (activeView === 'remarks') return <RemarksView remarks={remarks} setRemarks={setRemarks} students={students} user={user} showToast={showToast} />
    if (activeView === 'settings') return <SettingsView user={user} showToast={showToast} />
    return <Overview user={user} students={students} subjects={subjects} onNavigate={navigateView} onAddStudent={() => setStudentModalOpen(true)} onUpload={() => setUploadOpen(true)} onExport={exportStudents} adminSummary={adminSummary} adminSummaryError={adminSummaryError} onRetrySummary={retryDashboard} />
  }

  const retryDashboard = () => {
    console.info('[dashboard] Retrying dashboard data fetch.', { role: user.role, userId: user.id })
    setDashboardRefreshKey((value) => value + 1)
  }
  const dashboardContent = dashboardLoading && useRemoteData && !students.length
    ? <DashboardDataState loading message="We are securely loading the current academic records for this access scope." />
    : dashboardError && useRemoteData && !students.length
      ? <DashboardDataState title="Dashboard data unavailable" message={dashboardError} onRetry={retryDashboard} />
      : <><DashboardDataNotice message={dashboardError} onRetry={retryDashboard} />{renderContent()}</>

  return <Layout user={user} activeView={activeView} onNavigate={navigateView} onLogout={signOut} showBack={location.pathname !== '/app'} unreadCount={unreadCount}>{dashboardContent}{!isLearner && studentModalOpen && <StudentFormModal departmentScope={user.department === 'ALL' ? '' : user.department} existingStudents={students} onClose={() => setStudentModalOpen(false)} onSave={saveNewStudent} />}{!isLearner && uploadOpen && <UploadModal departmentScope={user.department === 'ALL' ? '' : user.department} existingStudents={students} onClose={() => setUploadOpen(false)} onImport={importStudents} onPreview={previewImportedStudents} />}{toast && <div className="toast"><FiCheckCircle /> {toast}</div>}</Layout>
}
