import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
  FiArrowLeft,
  FiAward,
  FiArrowDown,
  FiArrowRight,
  FiArrowUp,
  FiBell,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiEdit3,
  FiEye,
  FiFileText,
  FiFilter,
  FiGrid,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPlus,
  FiSearch,
  FiSend,
  FiSettings,
  FiShield,
  FiTrash2,
  FiTrendingUp,
  FiUser,
  FiUploadCloud,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { achievementTypes, cloneDemoStudents, demoAchievements, demoAnnouncements, demoMessages, demoRemarks, demoSections, getDemoSubjects } from '../data/demo'
import api, { DEMO_MODE, LOCAL_SESSION_TOKEN } from '../lib/api'
import { Brand } from './Landing'
import SectionSelection from './SectionSelection'

const semesterOrdinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
const riskColors = { Low: '#70B99B', Medium: '#E0B155', High: '#E27D63' }
const pieColors = ['#70B99B', '#E0B155', '#E27D63']

function normalizeSpreadsheetDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text)
    if (serial > 0) {
      const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    }
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const teacherNav = [
  { key: 'dashboard', label: 'Section dashboard', icon: FiGrid },
  { key: 'students', label: 'Students', icon: FiUsers },
  { key: 'attendance', label: 'Attendance', icon: FiClock },
  { key: 'marks', label: 'Internal marks', icon: FiBookOpen },
  { key: 'assignments', label: 'Assignments', icon: FiFileText },
  { key: 'achievements', label: 'Achievements', icon: FiAward },
  { key: 'remarks', label: 'Remarks', icon: FiHeart },
  { key: 'messages', label: 'Messages', icon: FiMessageCircle },
  { key: 'announcements', label: 'Announcements', icon: FiBell },
  { key: 'analytics', label: 'Analytics', icon: FiTrendingUp },
  { key: 'predictions', label: 'XGBoost predictions', icon: FiZap },
]

function Avatar({ initials, tone = '' }) {
  return <span className={`avatar ${tone}`}>{initials}</span>
}

function RiskBadge({ risk }) {
  return <span className={`risk-badge risk-${String(risk || 'Low').toLowerCase()}`}>{risk || 'Low'} risk</span>
}

function ScopeIntro({ eyebrow, title, description, actions }) {
  return <div className="page-intro"><div><p className="page-eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{description && <p className="page-subtitle">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="custom-tooltip"><p>{label}</p><strong>{payload[0].value}%</strong></div>
}

function scopedStudents(students, department, semester) {
  return students.filter((student) => student.department === department && Number(student.semester) === Number(semester))
}

function scopedSubjects(subjects, department, semester) {
  return subjects.filter((subject) => subject.department === department && Number(subject.semester) === Number(semester) && subject.isActive !== false)
}

function scopedAnnouncements(items, department, semester) {
  return items.filter((item) => item.department === department && Number(item.semester) === Number(semester))
}

function scopedMessages(items, department, semester) {
  return items.filter((item) => item.department === department && Number(item.semester) === Number(semester))
}

function scopedAchievements(items, department, semester, section = '') {
  return items.filter((item) => item.department === department && Number(item.semester) === Number(semester) && (!section || String(item.section || '').toUpperCase() === String(section).toUpperCase()))
}

function scopedSectionAnnouncements(items, department, semester, section) {
  const exact = items.filter((item) => item.department === department && Number(item.semester) === Number(semester) && item.section === section)
  return exact.length ? exact : [{ id: `section-announcement-${department}-${semester}-${section}`, title: `Section ${section} academic update`, body: `This is the dedicated announcement feed for ${department} Semester ${semester}, Section ${section}.`, type: 'Section', department, semester: Number(semester), section, author: 'CSE Department', date: 'Today', priority: 'Normal' }]
}

function scopedSectionMessages(items, department, semester, section) {
  const exact = items.filter((item) => item.department === department && Number(item.semester) === Number(semester) && item.section === section)
  return exact.length ? exact : [{ id: `section-message-${department}-${semester}-${section}`, department, semester: Number(semester), section, sender: 'CSE Department', recipient: `${department} · Semester ${semester} · Section ${section}`, audience: 'Students', subject: `Welcome to Section ${section}`, body: `This inbox is reserved for ${department} Semester ${semester}, Section ${section}. Your teacher messages will appear here.`, time: 'Today', read: true, initials: 'CD' }]
}

function trendFor(students, semester) {
  const average = students.length ? students.reduce((sum, student) => sum + Number(student.attendance || 0), 0) / students.length : 0
  const adjustments = [-4, -2, -1, 1, 0, 2, 1]
  return ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((month, index) => ({ month, attendance: Math.max(0, Math.min(100, Math.round(average + adjustments[index]))), target: 75, semester }))
}

function riskSummary(students) {
  return [
    { name: 'Low risk', value: students.filter((student) => student.risk === 'Low').length },
    { name: 'Medium risk', value: students.filter((student) => student.risk === 'Medium').length },
    { name: 'High risk', value: students.filter((student) => student.risk === 'High').length },
  ]
}

function TeacherShell({ user, semester, section = '', activeModule, children, onLogout }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const base = section ? `/teacher/semester/${semester}/section/${encodeURIComponent(section)}` : `/teacher/semester/${semester}`
  const goTo = (key) => {
    setSidebarOpen(false)
    if (key === 'selection') return navigate(section ? `/teacher/semester/${semester}` : '/teacher/semesters')
    if (key === 'profile') return navigate('/teacher/profile')
    if (key === 'settings') return navigate('/teacher/settings')
    navigate(key === 'dashboard' ? base : `${base}/${key}`)
  }
  return <div className="dashboard-layout">
    <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <Brand light />
      <button className="sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><FiX /></button>
      <button className="teacher-scope-link" type="button" onClick={() => goTo('selection')}><FiArrowDown /><span>{section ? 'Change section' : 'Change semester'}</span></button>
      <p className="sidebar-section-label">{section ? `Section ${section}` : `Semester ${semester}`}</p>
      <div className="sidebar-nav">{teacherNav.map(({ key, label, icon: Icon }) => <button key={key} type="button" className={activeModule === key ? 'active' : ''} onClick={() => goTo(key)}><Icon /><span>{label}</span></button>)}</div>
      <p className="sidebar-section-label teacher-account-label">Account</p>
      <div className="sidebar-nav teacher-account-nav"><button type="button" onClick={() => goTo('profile')}><FiUser /><span>Profile</span></button><button type="button" onClick={() => goTo('settings')}><FiSettings /><span>Settings</span></button></div>
      <div className="sidebar-bottom"><div className="sidebar-help"><strong><FiHeart style={{ verticalAlign: 'middle', marginRight: 5 }} /> Human-first insight</strong><p>Use every signal as a starting point for a better conversation.</p></div><div className="sidebar-profile"><Avatar initials={user.initials || 'AR'} /><div className="profile-meta"><strong>{user.name}</strong><span>{user.department} · Sem {semester}{section ? ` · Sec ${section}` : ''}</span></div><button className="logout-btn" type="button" onClick={onLogout} aria-label="Sign out"><FiLogOut /></button></div></div>
    </aside>
    <main className="dashboard-main"><header className="dashboard-topbar"><div className="breadcrumb"><button className="mobile-sidebar-trigger" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><FiMenu /></button><span>CAMPS</span><FiChevronRight /><strong>{user.department} · Semester {semester}{section ? ` · Section ${section}` : ''}</strong></div><div className="topbar-actions"><button className="topbar-icon" type="button" aria-label="Secure workspace"><FiShield /></button><button className="topbar-icon" type="button" aria-label="Notifications"><FiBell /><i className="notification-dot" /></button><span className="topbar-divider" /><div className="topbar-user"><Avatar initials={user.initials || 'AR'} /><div className="topbar-user-meta"><strong>{user.name}</strong><span>{user.department} · Semester {semester}</span></div></div></div></header>{children}</main>
  </div>
}

function SemesterDashboard({ user, semester, section = '', students, subjects, announcements, onNavigate }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const total = students.length
  const averageAttendance = total ? (students.reduce((sum, student) => sum + Number(student.attendance || 0), 0) / total).toFixed(1) : '0.0'
  const averageGpa = total ? (students.reduce((sum, student) => sum + Number(student.cgpa || 0), 0) / total).toFixed(1) : '0.0'
  const atRisk = students.filter((student) => student.risk !== 'Low').length
  const riskData = riskSummary(students)
  const trend = trendFor(students, semester)
  const notices = announcements.slice(0, 2)
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title={section ? `Section ${section} dashboard` : `Semester ${semester} dashboard`} description={`One complete view of the ${user.department} ${semesterOrdinals[semester - 1]} semester cohort${section ? ` in Section ${section}` : ''}.`} actions={<><button type="button" className="button-ghost" onClick={() => onNavigate('students')}><FiUsers /> View students</button><button type="button" className="button-primary" onClick={() => onNavigate('predictions')}><FiZap /> Prediction desk</button></>} /><div className="semester-context-banner"><FiShield /><span>This dashboard is scoped to <strong>{scope}</strong>. No other semester data is loaded here.</span><span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#70B99B' }} /> Live scope</span></div><SubjectCatalog subjects={subjects} scope={scope} compact /><div className="kpi-grid"><div className="kpi-card primary"><div className="kpi-top"><span className="kpi-label">Semester students</span><span className="kpi-icon"><FiUsers /></span></div><div className="kpi-value">{total}</div><span className="kpi-change"><FiCheckCircle /> {user.department} only</span></div><div className="kpi-card mint"><div className="kpi-top"><span className="kpi-label">Average attendance</span><span className="kpi-icon"><FiClock /></span></div><div className="kpi-value">{averageAttendance}%</div><span className="kpi-change"><FiArrowUp /> Cohort average</span></div><div className="kpi-card sky"><div className="kpi-top"><span className="kpi-label">Average GPA</span><span className="kpi-icon"><FiTrendingUp /></span></div><div className="kpi-value">{averageGpa}</div><span className="kpi-change"><FiArrowUp /> Semester performance</span></div><div className="kpi-card peach"><div className="kpi-top"><span className="kpi-label">Need attention</span><span className="kpi-icon"><FiAlertCircle /></span></div><div className="kpi-value">{atRisk}</div><span className="kpi-change alert"><FiArrowDown /> Early follow-up list</span></div></div><div className="chart-grid"><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Semester attendance rhythm</h2><p className="card-description">Only {user.department} · Semester {semester} records</p></div><span className="scope-pill">Sem {semester}</span></div><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}><defs><linearGradient id={`semesterAttendance${semester}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F07E5E" stopOpacity=".26" /><stop offset="100%" stopColor="#F07E5E" stopOpacity=".01" /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis domain={[55, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="target" stroke="#B3C8C0" strokeDasharray="5 5" strokeWidth={1.5} fill="none" /><Area type="monotone" dataKey="attendance" stroke="#F07E5E" strokeWidth={2.5} fill={`url(#semesterAttendance${semester})`} /></AreaChart></ResponsiveContainer></div></section><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Semester risk mix</h2><p className="card-description">Prediction snapshot for this cohort</p></div></div><div className="risk-card-content"><div className="risk-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" innerRadius={55} outerRadius={75} paddingAngle={3} stroke="none">{riskData.map((entry, index) => <Cell key={entry.name} fill={pieColors[index]} />)}</Pie></PieChart></ResponsiveContainer><div className="risk-center"><strong>{total}</strong><span>students</span></div></div><div className="risk-legend">{riskData.map((item, index) => <div className="legend-item" key={item.name}><i className="legend-dot" style={{ background: pieColors[index] }} /><span>{item.name.replace(' risk', '')}</span><strong>{item.value}</strong></div>)}</div></div></section></div><div className="section-grid"><section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">{user.department} · Semester {semester} roster</h2><p className="card-description">The first few records from this semester scope</p></div><button className="button-ghost" type="button" onClick={() => onNavigate('students')}>Open full list <FiArrowRight /></button></div><SemesterTable students={students.slice(0, 5)} compact onStudentClick={(student) => onNavigate('student', student.id)} /></section><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Semester notices</h2><p className="card-description">Only announcements for this semester</p></div><button className="row-action" type="button" onClick={() => onNavigate('announcements')}><FiArrowRight /></button></div><div className="alert-list">{notices.length ? notices.map((notice) => <div className="alert-row" key={notice.id}><span className="info-icon" style={{ width: 29, height: 29 }}><FiBell /></span><div className="alert-info"><strong>{notice.title}</strong><span>{notice.date}</span></div></div>) : <div className="empty-state">No announcements for Semester {semester}.</div>}</div></section></div></div>
}

function SemesterTable({ students, compact = false, onStudentClick }) {
  if (!students.length) return <div className="empty-state"><FiUsers /><span>No students in {compact ? 'this semester' : 'the selected filters'}.</span></div>
  return <div className="table-scroll"><table className="student-table"><thead><tr><th>Student</th><th>Section</th><th>Attendance</th><th>CGPA</th><th>Risk level</th>{!compact && <th>Actions</th>}</tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{onStudentClick ? <button className="student-profile-link" type="button" onClick={() => onStudentClick(student)}><div className="student-cell"><Avatar initials={student.initials} tone={student.risk === 'Low' ? 'mint' : ''} /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div></button> : <div className="student-cell"><Avatar initials={student.initials} tone={student.risk === 'Low' ? 'mint' : ''} /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div>}</td><td>{student.section}</td><td><div className="progress-inline"><span className="progress-track"><i className={`progress-fill ${student.attendance < 75 ? 'danger' : student.attendance < 80 ? 'warn' : ''}`} style={{ width: `${Math.min(100, student.attendance)}%` }} /></span><span>{student.attendance}%</span></div></td><td><strong style={{ color: '#15263a' }}>{Number(student.cgpa).toFixed(1)}</strong></td><td><RiskBadge risk={student.risk} /></td>{!compact && <td><button className="row-action" type="button" aria-label={`View ${student.name}`}><FiEye /></button></td>}</tr>)}</tbody></table></div>
}

function SemesterStudents({ user, semester, section = '', students, onNavigate }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('all')
  const filtered = students.filter((student) => (risk === 'all' || student.risk === risk) && `${student.name} ${student.usn}`.toLowerCase().includes(query.toLowerCase()))
  const exportScope = () => { const header = 'USN,Name,Department,Semester,Section,Attendance,CGPA,Risk\n'; const body = students.map((student) => [student.usn, student.name, student.department, student.semester, student.section, student.attendance, student.cgpa, student.risk].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n'); const blob = new Blob([header + body], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${user.department}-semester-${semester}-students.csv`; link.click(); URL.revokeObjectURL(url) }
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Students" description={`Only student records belonging to ${scope} are shown.`} actions={<><button className="button-ghost" type="button" onClick={exportScope}><FiDownload /> Export semester</button><button className="button-ghost" type="button" onClick={() => onNavigate('newStudent')}><FiPlus /> Add student</button><button className="button-ghost" type="button" onClick={() => onNavigate('uploadStudents')}><FiUploadCloud /> Upload Excel</button><button className="button-primary" type="button" onClick={() => onNavigate('predictions')}><FiZap /> Predict risk</button></>} /><div className="semester-context-banner"><FiShield /><span>Scope locked to <strong>{scope}</strong></span></div><div className="toolbar-card"><div className="search-field"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section ? `Section ${section}` : 'this semester'}`} aria-label="Search selected scope" /></div><div className="toolbar-filters"><select value={risk} onChange={(event) => setRisk(event.target.value)} aria-label="Filter risk"><option value="all">All risk levels</option><option value="Low">Low risk</option><option value="Medium">Medium risk</option><option value="High">High risk</option></select><span className="scope-pill">{filtered.length} records</span></div></div><section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">{section ? `Section ${section}` : `Semester ${semester}`} roster</h2><p className="card-description">{filtered.length} students · {user.department} only</p></div><span className="department-note"><FiShield /> No cross-semester records</span></div><SemesterTable students={filtered} onStudentClick={(student) => onNavigate('student', student.id)} /></section></div>
}

function readLocalSubjectRecords() {
  if (typeof window === 'undefined') return []
  try { const records = JSON.parse(window.localStorage.getItem('camps_subject_records') || '[]'); return Array.isArray(records) ? records : [] } catch { return [] }
}

function writeLocalSubjectRecord(subjectId, studentId, patch) {
  if (typeof window === 'undefined') return
  const records = readLocalSubjectRecords()
  const index = records.findIndex((item) => Number(item.subjectId) === Number(subjectId) && Number(item.studentId) === Number(studentId))
  if (index >= 0) records[index] = { ...records[index], ...patch, subjectId, studentId }
  else records.push({ subjectId, studentId, ...patch })
  window.localStorage.setItem('camps_subject_records', JSON.stringify(records))
}

function SubjectCatalog({ subjects, scope, compact = false }) {
  return <section className={`content-card subject-catalog-card ${compact ? 'compact' : ''}`}><div className="card-heading"><div><h2 className="card-title">Subjects for this semester</h2><p className="card-description">Synced curriculum · {scope}</p></div><span className="scope-pill"><FiShield /> Database synced</span></div>{subjects.length ? <div className="subject-catalog-grid">{subjects.map((subject) => <div className="subject-catalog-item" key={subject.subjectId || subject.id}><span>{subject.subjectCode}</span><strong>{subject.subjectName}</strong><small>{subject.credits} credits · Attendance &amp; marks ready</small></div>)}</div> : <div className="empty-state subject-empty-state"><FiBookOpen /><span>No subjects configured for this scope yet. Ask an administrator to add one.</span></div>}</section>
}

function SubjectEntryPanel({ mode, user, semester, section = '', students, subjects, notify }) {
  const { token } = useAuth()
  const apiSession = !DEMO_MODE && token && token !== LOCAL_SESSION_TOKEN
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.subjectId || subjects[0]?.id || '')
  const [records, setRecords] = useState({})
  const [savingStudent, setSavingStudent] = useState('')
  const selectedSubject = subjects.find((subject) => String(subject.subjectId || subject.id) === String(selectedSubjectId))
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  useEffect(() => {
    const next = Object.fromEntries(students.map((student) => [student.id, mode === 'attendance' ? Number(student.attendance || 0) : { ia1: Number(student.ia1 || 0), ia2: Number(student.ia2 || 0) }]))
    setRecords(next)
    if (!subjects.some((subject) => String(subject.subjectId || subject.id) === String(selectedSubjectId))) setSelectedSubjectId(subjects[0]?.subjectId || subjects[0]?.id || '')
  }, [subjects, students, mode])
  useEffect(() => {
    if (!selectedSubject || !selectedSubjectId) return undefined
    let mounted = true
    if (!apiSession) {
      const stored = readLocalSubjectRecords().filter((item) => Number(item.subjectId) === Number(selectedSubjectId))
      if (mounted && stored.length) setRecords((current) => {
        const next = { ...current }
        stored.forEach((record) => { next[record.studentId] = mode === 'attendance' ? Number(record.attendance ?? 0) : { ia1: Number(record.ia1 ?? 0), ia2: Number(record.ia2 ?? 0) } })
        return next
      })
      return undefined
    }
    if (!apiSession) return undefined
    api.getSubjectRecords(selectedSubjectId, { department: user.department, semester, section }).then((response) => {
      if (!mounted) return
      setRecords((current) => {
        const next = { ...current }
        ;(response.data || []).forEach((record) => { next[record.studentId] = mode === 'attendance' ? Number(record.attendance ?? 0) : { ia1: Number(record.ia1 ?? 0), ia2: Number(record.ia2 ?? 0) } })
        return next
      })
    }).catch(() => { /* aggregate roster values remain available */ })
    return () => { mounted = false }
  }, [selectedSubjectId, selectedSubject, user.department, semester, section, mode, apiSession])
  const updateAttendance = (studentId, value) => setRecords((current) => ({ ...current, [studentId]: Number(value) }))
  const updateMark = (studentId, key, value) => setRecords((current) => ({ ...current, [studentId]: { ...(current[studentId] || { ia1: 0, ia2: 0 }), [key]: Number(value) } }))
  const save = async (student) => {
    if (!selectedSubject) return
    setSavingStudent(student.id)
    const subjectId = selectedSubject.subjectId || selectedSubject.id
    const value = records[student.id]
    try {
      if (apiSession) {
        if (mode === 'attendance') await api.saveSubjectAttendance(subjectId, { studentId: student.id, attendance: Number(value), department: user.department, semester, section })
        else await api.saveSubjectMarks(subjectId, { studentId: student.id, ia1: Number(value?.ia1 || 0), ia2: Number(value?.ia2 || 0), department: user.department, semester, section })
      }
      writeLocalSubjectRecord(subjectId, student.id, mode === 'attendance' ? { attendance: Number(value) } : { ia1: Number(value?.ia1 || 0), ia2: Number(value?.ia2 || 0) })
      notify(`${selectedSubject.subjectCode} ${mode} saved for ${student.name}`)
    } catch (error) {
      notify(error.response?.data?.message || `Could not save ${mode} for ${student.name}`)
    } finally { setSavingStudent('') }
  }
  return <section className="content-card subject-entry-card"><div className="subject-entry-heading"><div><p className="page-eyebrow">Live subject catalog</p><h2>{mode === 'attendance' ? 'Enter attendance by subject' : 'Enter internal marks by subject'}</h2><p>New subjects from Subject Management are available here automatically for {scope}.</p></div><span className="subject-entry-badge"><FiCheckCircle /> {subjects.length} synced</span></div>{subjects.length ? <><div className="subject-entry-toolbar"><label htmlFor={`${mode}-subject-select`}>Subject<select id={`${mode}-subject-select`} value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>{subjects.map((subject) => <option value={subject.subjectId || subject.id} key={subject.subjectId || subject.id}>{subject.subjectCode} · {subject.subjectName}</option>)}</select></label><span>{selectedSubject?.credits || 0} credits · {students.length} students</span></div><div className="table-scroll subject-entry-table"><table className="student-table"><thead><tr><th>Student</th>{mode === 'attendance' ? <th>Attendance %</th> : <><th>IA 1 / 50</th><th>IA 2 / 50</th></>}<th>Action</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><div className="student-cell"><Avatar initials={student.initials} tone="mint" /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div></td>{mode === 'attendance' ? <td><input className="subject-entry-input" type="number" min="0" max="100" value={records[student.id] ?? 0} onChange={(event) => updateAttendance(student.id, event.target.value)} /></td> : <><td><input className="subject-entry-input" type="number" min="0" max="50" value={records[student.id]?.ia1 ?? 0} onChange={(event) => updateMark(student.id, 'ia1', event.target.value)} /></td><td><input className="subject-entry-input" type="number" min="0" max="50" value={records[student.id]?.ia2 ?? 0} onChange={(event) => updateMark(student.id, 'ia2', event.target.value)} /></td></>}<td><button className="subject-save-button" type="button" onClick={() => save(student)} disabled={savingStudent === student.id}><FiCheck /> {savingStudent === student.id ? 'Saving' : 'Save'}</button></td></tr>)}</tbody></table></div>{!students.length && <div className="empty-state"><FiUsers /><span>No students in {scope}.</span></div>}</> : <div className="empty-state subject-entry-empty"><FiBookOpen /><span>No subjects have been added for {scope}. An administrator can add one and it will appear here without any extra setup.</span></div>}</section>
}

function SemesterAttendance({ user, semester, section = '', students, subjects, onNavigate, notify }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const trend = trendFor(students, semester)
  const average = students.length ? (students.reduce((sum, student) => sum + Number(student.attendance || 0), 0) / students.length).toFixed(1) : '0.0'
  const belowTarget = students.filter((student) => student.attendance < 75).length
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Attendance" description={`Monitor attendance rhythm and focus follow-ups within ${scope}.`} actions={<span className="scope-pill"><FiShield /> Scope: {section ? `Section ${section}` : `Sem ${semester}`}</span>} /><div className="info-stat-grid"><div className="info-stat"><span>Semester average</span><strong>{average}%</strong><span className="kpi-change"><FiTrendingUp /> Current cohort</span></div><div className="info-stat"><span>Below 75% threshold</span><strong>{belowTarget}</strong><span className="kpi-change alert"><FiAlertCircle /> Follow up</span></div><div className="info-stat"><span>Students tracked</span><strong>{students.length}</strong><span className="kpi-change"><FiCheckCircle /> {scope}</span></div></div><section className="content-card" style={{ marginTop: 13 }}><div className="card-heading"><div><h2 className="card-title">Attendance trend · Semester {semester}</h2><p className="card-description">The semester target is 75%</p></div></div><div className="chart-container" style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}><defs><linearGradient id={`attendancePage${semester}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70B99B" stopOpacity=".3" /><stop offset="100%" stopColor="#70B99B" stopOpacity=".02" /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis domain={[55, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="target" stroke="#B3C8C0" strokeDasharray="5 5" fill="none" /><Area type="monotone" dataKey="attendance" stroke="#70B99B" strokeWidth={2.5} fill={`url(#attendancePage${semester})`} /></AreaChart></ResponsiveContainer></div></section><SubjectEntryPanel mode="attendance" user={user} semester={semester} section={section} students={students} subjects={subjects} notify={notify} /><section className="content-card table-card" style={{ marginTop: 13 }}><div className="table-card-head"><div><h2 className="card-title">Attendance register</h2><p className="card-description">Students are sorted within Semester {semester}</p></div></div><SemesterTable students={[...students].sort((a, b) => a.attendance - b.attendance)} compact onStudentClick={(student) => onNavigate('student', student.id)} /></section></div>
}

function SemesterMarks({ user, semester, section = '', students, subjects, onNavigate, notify }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const averages = ['IA 1', 'IA 2', 'Assignments'].map((label) => { const key = label === 'IA 1' ? 'ia1' : label === 'IA 2' ? 'ia2' : 'assignmentMarks'; const max = label === 'Assignments' ? 20 : 50; const value = students.length ? students.reduce((sum, student) => sum + Number(student[key] || 0), 0) / students.length : 0; return { label, score: Math.round(value), max, percentage: max ? Math.round(value / max * 100) : 0 } })
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Internal marks" description={`Review IA scores and assignment performance for ${scope} only.`} actions={<span className="scope-pill"><FiShield /> Scope: Sem {semester}</span>} /><div className="section-grid"><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Assessment performance</h2><p className="card-description">Semester cohort averages</p></div></div><div className="chart-container" style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={averages} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="percentage" fill="#F07E5E" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="content-card"><h2 className="card-title">Cohort averages</h2><div className="mark-bars">{averages.map((item) => <div className="mark-row" key={item.label}><span>{item.label}</span><i className="mark-bar"><i style={{ width: `${item.percentage}%` }} /></i><strong>{item.score}/{item.max}</strong></div>)}</div><div className="detail-list"><div className="detail-item"><span>Average CGPA</span><strong>{students.length ? (students.reduce((sum, student) => sum + Number(student.cgpa || 0), 0) / students.length).toFixed(1) : '0.0'}</strong></div><div className="detail-item"><span>Students with backlogs</span><strong>{students.filter((student) => Number(student.backlogs) > 0).length}</strong></div></div></section></div><SubjectEntryPanel mode="marks" user={user} semester={semester} section={section} students={students} subjects={subjects} notify={notify} /><section className="content-card table-card" style={{ marginTop: 13 }}><div className="table-card-head"><div><h2 className="card-title">{section ? `Section ${section}` : `Semester ${semester}`} marks register</h2><p className="card-description">Every record is scoped to {scope}</p></div></div><div className="table-scroll"><table className="student-table"><thead><tr><th>Student</th><th>IA 1 / 50</th><th>IA 2 / 50</th><th>Assignments / 20</th><th>Previous SGPA</th><th>CGPA</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><button className="student-profile-link" type="button" onClick={() => onNavigate('student', student.id)}><div className="student-cell"><Avatar initials={student.initials} tone="mint" /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div></button></td><td>{student.ia1}</td><td>{student.ia2}</td><td>{student.assignmentMarks}</td><td>{student.previousSgpa}</td><td><strong style={{ color: '#15263a' }}>{student.cgpa}</strong></td></tr>)}</tbody></table></div></section></div>
}

function achievementLabels(student) {
  const achievements = []
  if (Number(student.cgpa) >= 8.5) achievements.push('Consistent academic performer')
  if (Number(student.attendance) >= 85) achievements.push('Strong attendance rhythm')
  if (Number(student.backlogs) === 0) achievements.push('Clear academic record')
  return achievements.length ? achievements : ['Building momentum this semester']
}

function SemesterAssignments({ user, semester, section = '', students, onNavigate }) {
  const average = students.length ? (students.reduce((sum, student) => sum + Number(student.assignmentMarks || 0), 0) / students.length).toFixed(1) : '0.0'
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Assignments" description="Review assignment performance for this selected section only." actions={<span className="scope-pill"><FiShield /> Scope locked</span>} /><div className="semester-context-banner"><FiShield /><span>Every assignment record below belongs to <strong>{scope}</strong>.</span></div><div className="info-stat-grid"><div className="info-stat"><span>Average assignment mark</span><strong>{average}<small> / 20</small></strong><span className="kpi-change"><FiTrendingUp /> Selected section</span></div><div className="info-stat"><span>Completed submissions</span><strong>{students.filter((student) => Number(student.assignmentMarks || 0) > 0).length}</strong><span className="kpi-change"><FiCheckCircle /> {students.length} tracked</span></div><div className="info-stat"><span>Needs follow-up</span><strong>{students.filter((student) => Number(student.assignmentMarks || 0) < 10).length}</strong><span className="kpi-change alert"><FiAlertCircle /> Below 50%</span></div></div><section className="content-card table-card" style={{ marginTop: 13 }}><div className="table-card-head"><div><h2 className="card-title">{section ? `Section ${section}` : `Semester ${semester}`} assignment register</h2><p className="card-description">Marks are calculated only from {scope} students.</p></div></div><div className="table-scroll"><table className="student-table"><thead><tr><th>Student</th><th>Assignment mark</th><th>Completion</th><th>Risk</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><button className="student-profile-link" type="button" onClick={() => onNavigate('student', student)}><div className="student-cell"><Avatar initials={student.initials} /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div></button></td><td><strong>{student.assignmentMarks}</strong> / 20</td><td><div className="progress-inline"><span className="progress-track"><i className={`progress-fill ${student.assignmentMarks < 10 ? 'danger' : ''}`} style={{ width: `${Math.min(100, Number(student.assignmentMarks || 0) / 20 * 100)}%` }} /></span><span>{Math.round(Number(student.assignmentMarks || 0) / 20 * 100)}%</span></div></td><td><RiskBadge risk={student.risk} /></td></tr>)}</tbody></table></div>{!students.length && <div className="empty-state"><FiFileText /><span>No assignment records for {scope}.</span></div>}</section></div>
}

function formatAchievementDate(value) {
  if (!value) return 'Date not recorded'
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SemesterAchievements({ user, semester, section = '', students, achievements, onCreateAchievement, onNavigate }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ studentId: students[0]?.id || '', achievementType: achievementTypes[0], date: new Date().toISOString().slice(0, 10), title: '', description: '' })
  const visibleAchievements = achievements.filter((achievement) => students.some((student) => Number(student.id) === Number(achievement.studentId)))
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    const saved = await onCreateAchievement(form)
    setSaving(false)
    if (saved) {
      setForm({ studentId: students[0]?.id || '', achievementType: achievementTypes[0], date: new Date().toISOString().slice(0, 10), title: '', description: '' })
      setOpen(false)
    } else setError('We could not save this achievement. Check the fields and try again.')
  }
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Achievements" description="Record a meaningful academic, co-curricular or community milestone for a student in this section." actions={<button className="button-primary" type="button" onClick={() => { setOpen((value) => !value); setError('') }}>{open ? <FiX /> : <FiPlus />} {open ? 'Close form' : 'Add achievement'}</button>} /><div className="semester-context-banner"><FiShield /><span>Achievements are saved to <strong>{scope}</strong> and are read-only in student and parent portals.</span></div>{open && <form className="content-card achievement-form-card" onSubmit={submit}><div className="achievement-form-heading"><span className="achievement-form-icon"><FiAward /></span><div><p className="page-eyebrow">New academic record</p><h2>Add achievement</h2><p>Select a student from Section {section}, add the achievement details, and publish it to their academic record.</p></div></div><div className="achievement-scope-strip"><FiShield /><span>Current scope</span><strong>{user.department} · Semester {semester} · Section {section}</strong></div><div className="form-grid achievement-form-grid"><div className="form-field"><label className="plain-label" htmlFor="achievement-student">Student</label><select id="achievement-student" className="field-control" value={form.studentId} onChange={(event) => update('studentId', event.target.value)} required><option value="">Choose a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.usn}</option>)}</select></div><div className="form-field"><label className="plain-label" htmlFor="achievement-type">Achievement type</label><select id="achievement-type" className="field-control" value={form.achievementType} onChange={(event) => update('achievementType', event.target.value)} required>{achievementTypes.map((type) => <option key={type}>{type}</option>)}</select></div><div className="form-field"><label className="plain-label" htmlFor="achievement-date">Date</label><input id="achievement-date" className="field-control" type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required /></div><div className="form-field full"><label className="plain-label" htmlFor="achievement-title">Achievement title</label><input id="achievement-title" className="field-control" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Won first place at the inter-college hackathon" maxLength="180" required /></div><div className="form-field full"><label className="plain-label" htmlFor="achievement-description">Description</label><textarea id="achievement-description" className="field-control achievement-description-field" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Add a short description of the achievement and its impact…" maxLength="4000" rows="5" required /></div></div>{error && <div className="validation-error">{error}</div>}<div className="composer-actions"><button className="button-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" type="submit" disabled={saving || !students.length}><FiCheck /> {saving ? 'Saving achievement…' : 'Add achievement'}</button></div></form>}<section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">Section achievements</h2><p className="card-description">{visibleAchievements.length} record{visibleAchievements.length === 1 ? '' : 's'} · only students in Section {section}</p></div><span className="scope-pill"><FiShield /> Read-only portal sync</span></div><div className="achievement-record-list">{visibleAchievements.map((achievement) => { const student = students.find((item) => Number(item.id) === Number(achievement.studentId)); return <article className="achievement-record" key={achievement.id}><div className="achievement-record-icon"><FiAward /></div><div className="achievement-record-body"><div className="achievement-record-meta"><span className="achievement-type-pill">{achievement.achievementType}</span><time>{formatAchievementDate(achievement.date)}</time></div><h3>{achievement.title}</h3><p>{achievement.description}</p><button className="student-profile-link achievement-student-link" type="button" onClick={() => student && onNavigate('student', student)}><Avatar initials={student?.initials || 'ST'} tone="mint" /><span><strong>{student?.name || achievement.studentName}</strong><small>{student?.usn || achievement.usn} · Section {section}</small></span><FiArrowRight /></button></div></article> })}{!visibleAchievements.length && <div className="empty-state"><FiAward /><span>No achievements have been recorded for {scope} yet. Use Add achievement to create the first one.</span></div>}</div></section></div>
}

function SemesterRemarks({ user, semester, section = '', students, remarks, onNavigate }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const studentIds = new Set(students.map((student) => Number(student.id)))
  const visibleRemarks = remarks.filter((remark) => studentIds.has(Number(remark.studentId)))
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Remarks" description="Keep teacher context and follow-up notes inside this selected section." actions={<span className="scope-pill"><FiShield /> Scope locked</span>} /><div className="semester-context-banner"><FiShield /><span>Remarks below are linked only to students in <strong>{scope}</strong>.</span></div><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Teacher context</h2><p className="card-description">Private academic follow-up notes associated with this section.</p></div></div><div className="profile-remark-list section-remarks-list">{visibleRemarks.map((remark) => { const student = students.find((item) => Number(item.id) === Number(remark.studentId)); return <button type="button" className="section-remark-row" key={remark.id} onClick={() => student && onNavigate('student', student)}><span className="remark-label">{remark.label}</span><span><strong>{student?.name || remark.studentName || 'Student'}</strong><p>{remark.note}</p><small>{remark.date}</small></span><FiArrowRight /></button> })}{!visibleRemarks.length && <div className="empty-state"><FiHeart /><span>No remarks have been added for {scope} yet.</span></div>}</div></section></div>
}

function SemesterAnnouncements({ user, semester, section = '', announcements, setAnnouncements, notify }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const [form, setForm] = useState({ title: '', body: '', priority: 'Normal' })
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const visible = announcements.filter((item) => filter === 'All' || item.type === filter)
  const publish = async (event) => { event.preventDefault(); if (!form.title || !form.body) return; let item = { ...form, id: Date.now(), type: 'Semester', department: user.department, semester, section: section || undefined, author: user.name, date: 'Just now' }; if (!DEMO_MODE) { try { const response = await api.createAnnouncement({ ...form, type: 'Semester', department: user.department, semester, section }); item = response.data || item } catch { notify('API unavailable · announcement kept in this session') } } setAnnouncements((current) => [item, ...current]); setForm({ title: '', body: '', priority: 'Normal' }); setOpen(false); notify(`${scope} announcement published`) }
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Announcements" description={`Publish updates only to ${section ? `Section ${section} · ` : ''}this semester’s students.`} actions={<button className="button-primary" type="button" onClick={() => setOpen((value) => !value)}><FiPlus /> New announcement</button>} /><div className="semester-context-banner"><FiShield /><span>Every announcement on this page is addressed to <strong>{scope}</strong>.</span></div>{open && <form className="content-card inline-composer" onSubmit={publish}><div className="form-grid"><div className="form-field full"><label className="plain-label">Title</label><input className="field-control" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Project review tomorrow" required /></div><div className="form-field"><label className="plain-label">Priority</label><select className="field-control" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Normal</option><option>Medium</option><option>High</option></select></div><div className="form-field full"><label className="plain-label">Message</label><textarea className="field-control" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write a clear next step…" required /></div></div><div className="composer-actions"><button className="button-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" type="submit"><FiBell /> Publish to {section ? `Section ${section}` : `Semester ${semester}`}</button></div></form>}<div className="toolbar-card"><div><strong style={{ color: '#15263a', fontSize: 12 }}>{section ? `Section ${section}` : `Semester ${semester}`} updates</strong><span style={{ display: 'block', marginTop: 4, color: '#99a2a1', fontSize: 10 }}>{visible.length} scoped announcements</span></div><div className="toolbar-filters">{['All', section ? 'Section' : 'Semester'].map((item) => <button key={item} className={`filter-btn ${filter === item ? 'selected-filter' : ''}`} type="button" onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="announcement-grid">{visible.map((item) => <article className="announcement-card" key={item.id}><span className="announcement-type semester">{section ? `Section ${section}` : `Semester ${semester}`}</span><h3>{item.title}</h3><p>{item.body}</p><div className="announcement-footer"><span>{item.date} · <strong>{item.author}</strong></span><div className="announcement-actions"><button type="button" onClick={() => notify('This scoped announcement is ready to edit')} aria-label="Edit announcement"><FiEdit3 /></button><button type="button" onClick={() => { setAnnouncements((current) => current.filter((notice) => notice.id !== item.id)); notify('Announcement deleted') }} aria-label="Delete announcement"><FiTrash2 /></button></div></div></article>)}{!visible.length && <div className="empty-state"><FiBell /><span>No announcements for {scope} yet.</span></div>}</div></div>
}

function SemesterMessages({ user, semester, section = '', messages, setMessages, notify }) {
  const [selectedId, setSelectedId] = useState(messages[0]?.id)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ recipient: 'Semester students', subject: '', body: '' })
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const visible = messages.filter((message) => `${message.sender} ${message.recipient} ${message.subject}`.toLowerCase().includes(search.toLowerCase()))
  const selected = visible.find((message) => message.id === selectedId) || visible[0]
  const send = async (event) => { event.preventDefault(); if (!form.subject || !form.body) return; let message = { ...form, id: Date.now(), sender: user.name, audience: 'Students', department: user.department, semester, section: section || undefined, time: 'Just now', read: true, initials: user.initials }; if (!DEMO_MODE) { try { const response = await api.sendMessage({ ...form, recipient: form.recipient, audience: 'Students', department: user.department, semester, section }); message = response.data || message } catch { notify('API unavailable · message kept in this session') } } setMessages((current) => [message, ...current]); setOpen(false); setForm({ recipient: 'Semester students', subject: '', body: '' }); notify(`Message sent to ${scope}`) }
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Messages" description={`Conversations and messages for ${section ? `Section ${section} · ` : ''}this semester’s students and families.`} actions={<button className="button-primary" type="button" onClick={() => setOpen((value) => !value)}><FiPlus /> New message</button>} /><div className="semester-context-banner"><FiShield /><span>This inbox is locked to <strong>{scope}</strong>.</span></div>{open && <form className="content-card inline-composer" onSubmit={send}><div className="form-grid"><div className="form-field"><label className="plain-label">Recipient</label><select className="field-control" value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })}><option>Semester students</option><option>Student parents</option><option>Selected student</option></select></div><div className="form-field"><label className="plain-label">Subject</label><input className="field-control" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Subject" required /></div><div className="form-field full"><label className="plain-label">Message</label><textarea className="field-control" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write your message…" required /></div></div><div className="composer-actions"><button className="button-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" type="submit"><FiSend /> Send message</button></div></form>}<div className="messages-layout"><div className="message-list"><div className="message-list-head"><h3>{section ? `Section ${section}` : `Semester ${semester}`} inbox</h3><button type="button" onClick={() => setOpen(true)} aria-label="Compose message"><FiPlus /></button></div><div className="message-search search-field"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scoped messages" /></div>{visible.map((message) => <button className={`message-item ${selected?.id === message.id ? 'active' : ''}`} type="button" key={message.id} onClick={() => setSelectedId(message.id)}><Avatar initials={message.initials || 'AR'} tone="mint" /><span className="message-item-content"><span className="message-item-line"><strong>{message.sender}</strong><time>{String(message.time || message.created_at || '').replace('Today, ', '')}</time></span><p>{message.subject}</p></span></button>)}{!visible.length && <div className="empty-state"><FiMailIcon /><span>No messages for {scope} yet.</span></div>}</div><div className="message-detail">{selected ? <><div className="message-detail-head"><div><h2>{selected.subject}</h2><p>From {selected.sender} · To {selected.recipient} · Semester {semester}</p></div><button className="row-action" type="button" aria-label="More message actions"><FiMoreHorizontal /></button></div><div className="message-body"><div className="message-bubble">{selected.body}</div></div><div className="message-detail-footer"><input placeholder="Reply within this semester…" /><button type="button" onClick={() => notify('Reply composer is ready')} aria-label="Send reply"><FiSend /></button></div></> : <div className="empty-state"><FiMessageCircle /><span>Select a scoped message to read it.</span></div>}</div></div></div>
}

function FiMailIcon() {
  return <FiMessageCircle />
}

function UploadSemesterStudentsPage({ user, semester, section = '', students, onCancel, onImport }) {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const readSpreadsheet = (selectedFile) => {
    setFile(selectedFile)
    setRows([])
    setErrors([])
    setReading(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        const parsedRows = rawRows.map((row, index) => {
          const departmentValue = String(row.Department || row.department || user.department).trim().toUpperCase()
          const semesterValue = Number(row.Semester || row.semester || semester)
          return { id: `${Date.now()}-${index}`, usn: String(row.USN || row.usn || '').trim().toUpperCase(), name: String(row.Name || row.name || '').trim(), department: departmentValue, semester: semesterValue, section: String(row.Section || row.section || section || 'A').trim().toUpperCase(), gender: String(row.Gender || row.gender || '').trim(), email: String(row.Email || row.email || '').trim().toLowerCase(), phone: String(row.Phone || row.phone || '').trim(), parentName: String(row['Parent Name'] || row.parentName || '').trim(), parentPhone: String(row['Parent Phone'] || row.parentPhone || '').trim(), fatherName: String(row['Father Name'] || row.fatherName || '').trim(), motherName: String(row['Mother Name'] || row.motherName || '').trim(), parentEmail: String(row['Parent Email'] || row.parentEmail || '').trim().toLowerCase(), dateOfBirth: normalizeSpreadsheetDate(row['Date of Birth'] || row.dateOfBirth), bloodGroup: String(row['Blood Group'] || row.bloodGroup || '').trim(), address: String(row.Address || row.address || '').trim(), certifications: String(row.Certifications || row.certifications || '').trim(), skills: String(row.Skills || row.skills || '').trim(), attendance: Number(row.Attendance || row.attendance || 0), cgpa: Number(row.CGPA || row.cgpa || 0), ia1: Number(row.IA1 || row.ia1 || 0), ia2: Number(row.IA2 || row.ia2 || 0), assignmentMarks: Number(row['Assignment Marks'] || row.assignmentMarks || 0), previousSgpa: Number(row['Previous SGPA'] || row.previousSgpa || 0), backlogs: Number(row.Backlogs || row.backlogs || 0) }
        })
        const validation = []
        const seen = new Set()
        parsedRows.forEach((row, index) => {
          if (!row.usn) validation.push(`Row ${index + 2}: USN is required.`)
          if (!row.name) validation.push(`Row ${index + 2}: Name is required.`)
          if (!row.email || !/^\S+@\S+\.\S+$/.test(row.email)) validation.push(`Row ${index + 2}: a valid email is required.`)
          if (row.department !== user.department) validation.push(`Row ${index + 2}: department must be ${user.department}.`)
          if (row.semester !== Number(semester)) validation.push(`Row ${index + 2}: semester must be ${semester}.`)
          if (section && row.section !== section) validation.push(`Row ${index + 2}: section must be ${section}.`)
          if (row.attendance < 0 || row.attendance > 100) validation.push(`Row ${index + 2}: attendance must be between 0 and 100.`)
          if (row.cgpa < 0 || row.cgpa > 10) validation.push(`Row ${index + 2}: CGPA must be between 0 and 10.`)
          if (row.phone && !/^\+?[0-9 ()-]{10,18}$/.test(row.phone)) validation.push(`Row ${index + 2}: phone number is invalid.`)
          if (seen.has(row.usn)) validation.push(`Row ${index + 2}: duplicate USN in this file.`)
          if (students.some((student) => student.usn.toUpperCase() === row.usn)) validation.push(`Row ${index + 2}: USN already exists in Semester ${semester}.`)
          seen.add(row.usn)
        })
        setRows(parsedRows)
        setErrors(validation)
      } catch {
        setRows([])
        setErrors(['This file could not be read. Upload a valid .xlsx, .xls or .csv file.'])
      } finally { setReading(false) }
    }
    reader.onerror = () => { setReading(false); setErrors(['The spreadsheet could not be opened. Please try again.']) }
    reader.readAsArrayBuffer(selectedFile)
  }
  const downloadTemplate = () => {
    const template = [{ USN: '4PM25CS101', Name: 'Sample Student', Department: user.department, Semester: semester, Section: section || 'A', Gender: 'Female', Email: 'sample@pestrust.edu.in', Phone: '+91 98450 00000', 'Parent Name': 'Parent Name', 'Parent Phone': '+91 98450 00001', 'Father Name': 'Parent Name', 'Mother Name': 'Mother Name', 'Parent Email': 'parent@example.com', 'Date of Birth': '2004-06-15', 'Blood Group': 'O+', Address: 'Residential address', Certifications: 'NPTEL, AWS', Skills: 'Python, React', Attendance: 80, CGPA: 7.5, IA1: 35, IA2: 36, 'Assignment Marks': 16, 'Previous SGPA': 7.4, Backlogs: 0 }]
    const worksheet = XLSX.utils.json_to_sheet(template)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Semester ${semester}`)
    XLSX.writeFile(workbook, `${user.department}-semester-${semester}-student-template.xlsx`)
  }
  const importRows = async () => {
    if (!rows.length || errors.length || importing) return
    setImporting(true)
    await onImport(rows, file)
    setImporting(false)
  }
  return <div className="dashboard-content upload-student-page"><button className="profile-back-link" type="button" onClick={onCancel}><FiArrowLeft /> Back to {section ? `Section ${section}` : `Semester ${semester}`} students</button><ScopeIntro eyebrow={`${user.department} · Semester ${semester}`} title="Upload student roster" description={`Add multiple students to ${section ? `Section ${section} · ` : ''}Semester ${semester}. The current department, semester and section are locked.`} actions={<button className="button-ghost" type="button" onClick={downloadTemplate}><FiDownload /> Download template</button>} /><div className="semester-context-banner"><FiShield /><span>Every imported row must belong to <strong>{user.department} · Semester {semester}{section ? ` · Section ${section}` : ''}</strong>. Other departments, semesters and sections are rejected.</span></div><section className="content-card upload-workflow"><div className="upload-steps"><span className="active"><b>1</b> Upload</span><span><b>2</b> Preview &amp; validate</span><span><b>3</b> Import</span></div>{!file && <div className="dropzone"><FiUploadCloud /><div><strong>Upload the {section ? `Section ${section}` : 'semester'} roster</strong><span>Accepted formats: .xlsx, .xls and .csv · Required columns: USN, Name, Email</span><label htmlFor="semester-roster-file">Choose Excel file<input id="semester-roster-file" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && readSpreadsheet(event.target.files[0])} /></label></div></div>}{file && <><div className="upload-summary"><span><FiFileText style={{ verticalAlign: 'middle', marginRight: 6 }} /> {file.name}</span>{reading ? <strong>Reading…</strong> : <strong>{rows.length} row{rows.length === 1 ? '' : 's'} found</strong>}</div>{!reading && errors.length > 0 && <div className="validation-error"><strong>Fix these validation errors before importing:</strong>{errors.slice(0, 5).map((error) => <div key={error}>{error}</div>)}{errors.length > 5 && <div>+ {errors.length - 5} more validation errors</div>}</div>}{!reading && rows.length > 0 && <div className="table-scroll upload-preview-table"><table className="student-table"><thead><tr><th>USN</th><th>Name</th><th>Department</th><th>Semester</th><th>Attendance</th><th>CGPA</th></tr></thead><tbody>{rows.slice(0, 8).map((row) => <tr key={row.id}><td>{row.usn || '—'}</td><td>{row.name || '—'}</td><td>{row.department}</td><td>{row.semester}</td><td>{row.attendance}%</td><td>{row.cgpa}</td></tr>)}</tbody></table></div>}{!reading && rows.length > 8 && <p className="upload-more">Showing first 8 rows of {rows.length}. All valid rows will be imported.</p>}</>}</section><div className="upload-page-actions"><button className="button-ghost" type="button" onClick={onCancel}>Cancel</button>{file && <button className="button-ghost" type="button" onClick={() => { setFile(null); setRows([]); setErrors([]) }}>Choose another file</button>}<button className="button-primary" type="button" disabled={!rows.length || errors.length > 0 || reading || importing} onClick={importRows}><FiCheck /> {importing ? 'Importing…' : `Validate & import ${rows.length || ''}`}</button></div></div>
}

function AddSemesterStudentPage({ user, semester, section = '', students, onCancel, onSave }) {
  const [form, setForm] = useState({ usn: '', name: '', section: section || 'A', gender: 'Female', email: '', phone: '', parentName: '', parentPhone: '', dateOfBirth: '', bloodGroup: '', address: '', fatherName: '', motherName: '', parentEmail: '', certifications: '', skills: '', attendance: 75, cgpa: 7, ia1: 30, ia2: 30, assignmentMarks: 15, previousSgpa: 7, backlogs: 0 })
  const [error, setError] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event) => { event.preventDefault(); if (!form.usn || !form.name || !form.email) { setError('USN, name and email are required.'); return } if (students.some((student) => student.usn.toUpperCase() === form.usn.toUpperCase())) { setError('This USN already exists in the selected semester.'); return } if (!/^\S+@\S+\.\S+$/.test(form.email)) { setError('Enter a valid student email address.'); return } if (form.phone && !/^\+?[0-9 ()-]{10,18}$/.test(form.phone)) { setError('Enter a valid phone number.'); return } onSave({ ...form, usn: form.usn.toUpperCase(), department: user.department, semester: Number(semester), section: section || form.section, attendance: Number(form.attendance), cgpa: Number(form.cgpa), ia1: Number(form.ia1), ia2: Number(form.ia2), assignmentMarks: Number(form.assignmentMarks), previousSgpa: Number(form.previousSgpa), backlogs: Number(form.backlogs) }) }
  return <div className="dashboard-content add-student-page"><button className="profile-back-link" type="button" onClick={onCancel}><FiArrowLeft /> Back to {section ? `Section ${section}` : `Semester ${semester}`} students</button><ScopeIntro eyebrow={`${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`} title="Add a student" description={`Create a student record inside ${section ? `Section ${section} · ` : ''}this semester only. Department, semester and section are locked to your workspace.`} actions={<span className="scope-pill"><FiShield /> {user.department} · Sem {semester}{section ? ` · Sec ${section}` : ''}</span>} /><div className="semester-context-banner"><FiShield /><span>New records are saved to <strong>{user.department} · Semester {semester}{section ? ` · Section ${section}` : ''}</strong>. They will not appear in another scope.</span></div><form className="content-card add-student-form" onSubmit={submit}><div className="profile-card-heading"><div><h2>Personal information</h2><p>Student and parent contact details</p></div><FiUser /></div><div className="form-grid add-form-grid"><div className="form-field"><label className="plain-label">USN</label><input className="field-control" value={form.usn} onChange={(event) => update('usn', event.target.value)} placeholder="4PM25CS101" required /></div><div className="form-field"><label className="plain-label">Student name</label><input className="field-control" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full name" required /></div><div className="form-field"><label className="plain-label">Department</label><input className="field-control locked-field" value={user.department} readOnly /></div><div className="form-field"><label className="plain-label">Semester</label><input className="field-control locked-field" value={`Semester ${semester}`} readOnly /></div><div className="form-field"><label className="plain-label">Section</label>{section ? <input className="field-control locked-field" value={section} readOnly /> : <select className="field-control" value={form.section} onChange={(event) => update('section', event.target.value)}><option>A</option><option>B</option><option>C</option></select>}</div><div className="form-field"><label className="plain-label">Gender</label><select className="field-control" value={form.gender} onChange={(event) => update('gender', event.target.value)}><option>Female</option><option>Male</option><option>Other</option></select></div><div className="form-field"><label className="plain-label">Email address</label><input className="field-control" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="student@pestrust.edu.in" required /></div><div className="form-field"><label className="plain-label">Phone number</label><input className="field-control" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91 98XXX XXXXX" /></div><div className="form-field"><label className="plain-label">Parent / guardian</label><input className="field-control" value={form.parentName} onChange={(event) => update('parentName', event.target.value)} placeholder="Parent name" /></div><div className="form-field"><label className="plain-label">Parent phone</label><input className="field-control" value={form.parentPhone} onChange={(event) => update('parentPhone', event.target.value)} placeholder="+91 98XXX XXXXX" /></div><div className="form-field"><label className="plain-label">Date of birth</label><input className="field-control" type="date" value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></div><div className="form-field"><label className="plain-label">Blood group</label><select className="field-control" value={form.bloodGroup} onChange={(event) => update('bloodGroup', event.target.value)}><option value="">Not recorded</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div><div className="form-field full"><label className="plain-label">Address</label><textarea className="field-control" value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Residential address" /></div><div className="form-field"><label className="plain-label">Father / guardian name</label><input className="field-control" value={form.fatherName} onChange={(event) => update('fatherName', event.target.value)} placeholder="Father or primary guardian" /></div><div className="form-field"><label className="plain-label">Mother name</label><input className="field-control" value={form.motherName} onChange={(event) => update('motherName', event.target.value)} placeholder="Mother name" /></div><div className="form-field"><label className="plain-label">Parent email</label><input className="field-control" type="email" value={form.parentEmail} onChange={(event) => update('parentEmail', event.target.value)} placeholder="parent@example.com" /></div><div className="form-field"><label className="plain-label">Certifications</label><input className="field-control" value={form.certifications} onChange={(event) => update('certifications', event.target.value)} placeholder="AWS, NPTEL (comma separated)" /></div><div className="form-field"><label className="plain-label">Skills</label><input className="field-control" value={form.skills} onChange={(event) => update('skills', event.target.value)} placeholder="React, Python (comma separated)" /></div></div><div className="profile-card-heading add-form-section-heading"><div><h2>Academic starting point</h2><p>These fields are used by attendance monitoring and prediction.</p></div><FiActivity /></div><div className="form-grid add-form-grid"><div className="form-field"><label className="plain-label">Attendance %</label><input className="field-control" type="number" min="0" max="100" value={form.attendance} onChange={(event) => update('attendance', event.target.value)} /></div><div className="form-field"><label className="plain-label">Current CGPA</label><input className="field-control" type="number" min="0" max="10" step="0.1" value={form.cgpa} onChange={(event) => update('cgpa', event.target.value)} /></div><div className="form-field"><label className="plain-label">IA 1 marks / 50</label><input className="field-control" type="number" min="0" max="50" value={form.ia1} onChange={(event) => update('ia1', event.target.value)} /></div><div className="form-field"><label className="plain-label">IA 2 marks / 50</label><input className="field-control" type="number" min="0" max="50" value={form.ia2} onChange={(event) => update('ia2', event.target.value)} /></div><div className="form-field"><label className="plain-label">Assignments / 20</label><input className="field-control" type="number" min="0" max="20" value={form.assignmentMarks} onChange={(event) => update('assignmentMarks', event.target.value)} /></div><div className="form-field"><label className="plain-label">Previous SGPA</label><input className="field-control" type="number" min="0" max="10" step="0.1" value={form.previousSgpa} onChange={(event) => update('previousSgpa', event.target.value)} /></div><div className="form-field"><label className="plain-label">Active backlogs</label><input className="field-control" type="number" min="0" max="10" value={form.backlogs} onChange={(event) => update('backlogs', event.target.value)} /></div></div>{error && <div className="validation-error">{error}</div>}<div className="composer-actions"><button className="button-ghost" type="button" onClick={onCancel}>Cancel</button><button className="button-primary" type="submit"><FiCheck /> Save student to Semester {semester}</button></div></form></div>
}

function StudentProfilePage({ user, semester, student, remarks, achievements, onNavigate }) {
  if (!student) return <div className="dashboard-content"><button className="profile-back-link" type="button" onClick={() => onNavigate('students')}><FiArrowLeft /> Back to Semester {semester} students</button><div className="content-card empty-state"><FiUsers /><span>This student does not belong to {user.department} · Semester {semester}.</span></div></div>
  const studentRemarks = remarks.filter((remark) => Number(remark.studentId) === Number(student.id))
  const marks = [
    { label: 'IA 1', value: Number(student.ia1 || 0), max: 50 },
    { label: 'IA 2', value: Number(student.ia2 || 0), max: 50 },
    { label: 'Assignments', value: Number(student.assignmentMarks || 0), max: 20 },
  ]
  const studentAchievements = (achievements || []).filter((achievement) => Number(achievement.studentId) === Number(student.id))
  const achievementHighlights = studentAchievements.length ? studentAchievements.map((achievement) => achievement.title) : achievementLabels(student)
  const trend = trendFor([student], semester)
  return <div className="dashboard-content profile-page"><button className="profile-back-link" type="button" onClick={() => onNavigate('students')}><FiArrowLeft /> Back to {user.department} · Semester {semester} students</button><section className="profile-hero-card"><div className="profile-identity"><Avatar initials={student.initials} tone={student.risk === 'Low' ? 'mint' : ''} /><div><p className="page-eyebrow">Full student profile · {user.department} · Semester {semester}</p><h1>{student.name}</h1><p>{student.usn} <span>·</span> Section {student.section} <span>·</span> {student.email}</p></div></div><div className="profile-hero-status"><RiskBadge risk={student.risk} /><span>{student.passProbability}% pass probability</span></div></section><div className="profile-layout"><div className="profile-primary"><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Personal information</h2><p>Identity and contact details from the {user.department} Semester {semester} roster.</p></div><FiUser /></div><div className="profile-detail-grid"><div><span>Full name</span><strong>{student.name}</strong></div><div><span>University seat number</span><strong>{student.usn}</strong></div><div><span>Gender</span><strong>{student.gender || 'Not recorded'}</strong></div><div><span>Date of birth</span><strong>{student.dateOfBirth || 'Not recorded'}</strong></div><div><span>Blood group</span><strong>{student.bloodGroup || 'Not recorded'}</strong></div><div><span>Email address</span><strong>{student.email}</strong></div><div><span>Phone number</span><strong>{student.phone || 'Not recorded'}</strong></div><div className="profile-detail-wide"><span>Address</span><strong>{student.address || 'Not recorded'}</strong></div><div><span>Department</span><strong>{student.department}</strong></div><div><span>Semester</span><strong>Semester {student.semester}</strong></div><div><span>Section</span><strong>{student.section}</strong></div></div></section><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Academic snapshot</h2><p>Current academic standing for this semester.</p></div><FiBookOpen /></div><div className="profile-stat-grid"><div><span>Current CGPA</span><strong>{Number(student.cgpa).toFixed(1)}</strong><small>/ 10</small></div><div><span>Previous SGPA</span><strong>{Number(student.previousSgpa || 0).toFixed(1)}</strong><small>/ 10</small></div><div><span>Internal total</span><strong>{Number(student.ia1 || 0) + Number(student.ia2 || 0)}</strong><small>/ 100</small></div><div><span>Active backlogs</span><strong>{student.backlogs}</strong><small>{Number(student.backlogs) === 0 ? 'Clear' : 'Needs review'}</small></div></div></section><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Attendance record</h2><p>Only attendance from {user.department} · Semester {semester} is represented.</p></div><strong className="profile-big-number">{student.attendance}%</strong></div><div className="profile-attendance-meter"><div><span>Attendance</span><strong>{student.attendance}%</strong></div><div className="profile-meter-track"><i style={{ width: `${Math.min(100, student.attendance)}%` }} /></div><div className="profile-meter-foot"><span>0%</span><span>75% minimum</span><span>100%</span></div></div><div className="profile-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 7, left: -25, bottom: 0 }}><defs><linearGradient id={`studentAttendance${student.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70B99B" stopOpacity=".3" /><stop offset="100%" stopColor="#70B99B" stopOpacity=".02" /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis domain={[55, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="attendance" stroke="#70B99B" strokeWidth={2.5} fill={`url(#studentAttendance${student.id})`} /></AreaChart></ResponsiveContainer></div></section><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Marks &amp; assessments</h2><p>Internal assessment and assignment performance.</p></div><FiFileText /></div><div className="profile-mark-list">{marks.map((mark) => <div className="profile-mark-row" key={mark.label}><div><span>{mark.label}</span><strong>{mark.value} / {mark.max}</strong></div><div className="profile-mark-track"><i style={{ width: `${Math.min(100, mark.value / mark.max * 100)}%` }} /></div><small>{Math.round(mark.value / mark.max * 100)}%</small></div>)}</div><div className="profile-subject-note"><span>Assessment note</span><strong>IA performance is included in the semester prediction.</strong></div></section><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Additional information</h2><p>Certifications and practical skills shared in the learner profile.</p></div><FiActivity /></div><div className="profile-tag-group"><span>Certifications</span><div>{(student.certifications || []).length ? student.certifications.map((item) => <em key={item}>{item}</em>) : <small>Not recorded</small>}</div></div><div className="profile-tag-group"><span>Skills</span><div>{(student.skills || []).length ? student.skills.map((item) => <em key={item}>{item}</em>) : <small>Not recorded</small>}</div></div></section></div><aside className="profile-secondary"><section className="profile-prediction-card"><div className="profile-card-heading"><div><p className="profile-card-kicker">XGBoost prediction</p><h2>Academic outlook</h2></div><FiZap /></div><div className="profile-prediction-risk"><span>Risk level</span><RiskBadge risk={student.risk} /></div><div className="profile-probability"><div><span>Pass probability</span><strong>{student.passProbability}%</strong></div><div className="probability-track"><i style={{ width: `${student.passProbability}%` }} /></div></div><p className="profile-prediction-copy">Built from attendance, IA1, IA2, assignments, previous SGPA, CGPA and backlogs for this student.</p><button className="profile-prediction-link" type="button" onClick={() => onNavigate('predictions')}><FiZap /> Open prediction desk <FiArrowRight /></button></section><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Parent / guardian</h2><p>Linked contact information</p></div><FiUsers /></div><div className="profile-contact"><Avatar initials={(student.fatherName || student.parentName || 'PG').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()} tone="sky" /><div><strong>{student.fatherName || student.parentName || 'Not recorded'}</strong><span>Father / primary guardian</span></div></div><div className="profile-contact-details"><div><span>Mother name</span><strong>{student.motherName || 'Not recorded'}</strong></div><div><span>Parent phone</span><strong>{student.parentPhone || 'Not recorded'}</strong></div><div><span>Parent email</span><strong>{student.parentEmail || 'Not recorded'}</strong></div><div><span>Preferred channel</span><strong>CAMPS message</strong></div></div><button className="button-ghost profile-message-button" type="button" onClick={() => onNavigate('messages')}><FiSend /> Message parent</button></section><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Achievements</h2><p>Highlights recorded for this learner.</p></div><FiAward /></div><div className="achievement-list">{studentAchievements.length ? studentAchievements.map((achievement) => <div className="profile-achievement-record" key={achievement.id}><span><FiCheck /></span><div><strong>{achievement.title}</strong><small>{achievement.achievementType} · {formatAchievementDate(achievement.date)}</small><p>{achievement.description}</p></div></div>) : achievementHighlights.map((achievement) => <div key={achievement}><span><FiCheck /></span><strong>{achievement}</strong></div>)}</div><button className="profile-text-link" type="button" onClick={() => onNavigate('achievements')}><FiPlus /> Open achievements workspace</button></section><section className="content-card profile-card"><div className="profile-card-heading"><div><h2>Teacher context</h2><p>Remarks visible to the student and parent.</p></div><FiHeart /></div>{studentRemarks.length ? <div className="profile-remark-list">{studentRemarks.map((remark) => <div key={remark.id}><span>{remark.label}</span><p>{remark.note}</p><small>{remark.date}</small></div>)}</div> : <div className="profile-empty-note">No remarks have been added for this student yet.</div>}</section></aside></div></div>
}

export function TeacherStudentProfile() {
  const { user, logout } = useAuth()
  const { usn: usnParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const usn = decodeURIComponent(usnParam || '').toUpperCase()
  const profileParams = new URLSearchParams(location.search)
  const requestedSemester = Number(profileParams.get('semester')) || 0
  const requestedSection = String(profileParams.get('section') || '').trim().toUpperCase()
  const matchesScope = (item) => item.department === user.department && item.usn?.toUpperCase() === usn && (!requestedSemester || Number(item.semester) === requestedSemester) && (!requestedSection || String(item.section || '').toUpperCase() === requestedSection)
  const [student, setStudent] = useState(() => cloneDemoStudents().find(matchesScope) || null)
  const [remarks, setRemarks] = useState(() => demoRemarks)
  const [achievements, setAchievements] = useState(() => demoAchievements.filter((item) => item.usn === usn))
  const [loading, setLoading] = useState(!DEMO_MODE)

  useEffect(() => {
    if (DEMO_MODE) {
      setStudent(cloneDemoStudents().find(matchesScope) || null)
      setAchievements(demoAchievements.filter((item) => item.usn === usn))
      setLoading(false)
      return undefined
    }
    let mounted = true
    Promise.allSettled([
      api.getStudents({ department: user.department, semester: requestedSemester || undefined, section: requestedSection || undefined, search: usn, limit: 100 }),
      api.getRemarks({ department: user.department }),
      api.getAchievements({ department: user.department, studentUsn: usn }),
    ]).then(([studentResult, remarkResult, achievementResult]) => {
      if (!mounted) return
      const rows = studentResult.status === 'fulfilled' ? studentResult.value?.data || [] : []
      setStudent(rows.find(matchesScope) || null)
      if (remarkResult.status === 'fulfilled' && remarkResult.value?.data) setRemarks(remarkResult.value.data)
      if (achievementResult.status === 'fulfilled' && achievementResult.value?.data) setAchievements(achievementResult.value.data.filter((item) => item.usn?.toUpperCase() === usn))
      setLoading(false)
    })
    return () => { mounted = false }
  }, [user.department, usn, requestedSemester, requestedSection])

  const semester = Number(student?.semester) || requestedSemester || 1
  const section = student?.section || requestedSection
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }
  const onNavigate = (module) => {
    const target = section ? `/teacher/semester/${semester}/section/${encodeURIComponent(section)}` : `/teacher/semester/${semester}`
    navigate(module === 'dashboard' ? target : `${target}/${module}`)
  }
  const content = loading ? <div className="dashboard-content"><div className="content-card empty-state"><FiUsers /><span>Loading the student profile…</span></div></div> : <StudentProfilePage user={user} semester={semester} student={student} remarks={remarks.filter((remark) => !student || Number(remark.studentId) === Number(student.id))} achievements={achievements} onNavigate={onNavigate} />
  return <TeacherShell user={user} semester={semester} section={section} activeModule="students" onLogout={signOut}>{content}</TeacherShell>
}

function SemesterAnalytics({ user, semester, section = '', students }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const attendanceBuckets = [
    { label: '< 75%', count: students.filter((student) => student.attendance < 75).length },
    { label: '75–84%', count: students.filter((student) => student.attendance >= 75 && student.attendance < 85).length },
    { label: '85%+', count: students.filter((student) => student.attendance >= 85).length },
  ]
  const performanceBuckets = [
    { label: 'Below 6.5', count: students.filter((student) => student.cgpa < 6.5).length },
    { label: '6.5–7.9', count: students.filter((student) => student.cgpa >= 6.5 && student.cgpa < 8).length },
    { label: '8.0+', count: students.filter((student) => student.cgpa >= 8).length },
  ]
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="Analytics" description="Understand the patterns inside this selected scope without mixing other cohorts." actions={<span className="scope-pill"><FiShield /> Scope locked</span>} /><div className="semester-context-banner"><FiShield /><span>All metrics below are calculated from <strong>{students.length} {scope} records</strong>.</span></div><div className="section-grid"><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Attendance bands</h2><p className="card-description">Semester students by attendance threshold</p></div></div><div className="chart-container" style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={attendanceBuckets} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="count" fill="#70B99B" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="content-card"><div className="card-heading"><div><h2 className="card-title">CGPA bands</h2><p className="card-description">Academic performance distribution</p></div></div><div className="chart-container" style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={performanceBuckets} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="count" fill="#8BBFD7" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></section></div><section className="content-card" style={{ marginTop: 13 }}><div className="card-heading"><div><h2 className="card-title">Semester insight queue</h2><p className="card-description">Prioritised students based on this cohort’s signals</p></div></div><div className="alert-list">{students.filter((student) => student.risk !== 'Low').sort((a, b) => a.attendance - b.attendance).slice(0, 5).map((student) => <div className="alert-row" key={student.id}><Avatar initials={student.initials} /><div className="alert-info"><strong>{student.name}</strong><span>{student.attendance}% attendance · {student.cgpa} CGPA · {student.backlogs} backlog(s)</span></div><RiskBadge risk={student.risk} /></div>)}{!students.some((student) => student.risk !== 'Low') && <div className="empty-state"><FiCheckCircle /><span>This semester has no students in the attention queue.</span></div>}</div></section></div>
}

function SemesterPredictions({ user, semester, section = '', students, notify }) {
  const scope = `${user.department} · Semester ${semester}${section ? ` · Section ${section}` : ''}`
  const [selectedId, setSelectedId] = useState(students[0]?.id || '')
  const selected = students.find((student) => String(student.id) === String(selectedId)) || students[0]
  const [features, setFeatures] = useState(selected ? { attendance: selected.attendance, ia1: selected.ia1, ia2: selected.ia2, assignmentMarks: selected.assignmentMarks, previousSgpa: selected.previousSgpa, cgpa: selected.cgpa, backlogs: selected.backlogs } : { attendance: 75, ia1: 30, ia2: 30, assignmentMarks: 15, previousSgpa: 7, cgpa: 7, backlogs: 0 })
  const [result, setResult] = useState(selected ? { risk: selected.risk, pass_probability: selected.passProbability } : null)
  const [running, setRunning] = useState(false)
  const choose = (id) => { const student = students.find((item) => String(item.id) === String(id)); setSelectedId(id); if (student) { setFeatures({ attendance: student.attendance, ia1: student.ia1, ia2: student.ia2, assignmentMarks: student.assignmentMarks, previousSgpa: student.previousSgpa, cgpa: student.cgpa, backlogs: student.backlogs }); setResult({ risk: student.risk, pass_probability: student.passProbability }) } }
  const update = (key, value) => setFeatures((current) => ({ ...current, [key]: Number(value) }))
  const predict = async () => { setRunning(true); let next; if (!DEMO_MODE) { try { next = await api.predict({ ...features, department: user.department, semester }) } catch { /* client fallback */ } } if (!next) { await new Promise((resolve) => window.setTimeout(resolve, 500)); const probability = Math.max(24, Math.min(99, Math.round(features.attendance * .38 + ((features.ia1 + features.ia2) / 2) * .25 + features.assignmentMarks * .12 + features.previousSgpa * 4 + features.cgpa * 3 - features.backlogs * 8))); next = { risk: probability >= 78 ? 'Low' : probability >= 58 ? 'Medium' : 'High', pass_probability: probability } } setResult(next); setRunning(false); notify(`Prediction refreshed for Semester ${semester}`) }
  return <div className="dashboard-content"><ScopeIntro eyebrow={scope} title="XGBoost predictions" description="Run predictions only against students in this selected scope." actions={<span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#70B99B' }} /> Model online</span>} /><div className="semester-context-banner"><FiShield /><span>Prediction scope: <strong>{scope}</strong>. The model cannot select another cohort here.</span></div><div className="section-grid"><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Run prediction</h2><p className="card-description">Seven signals · POST /api/ml/predict</p></div></div><div className="form-field" style={{ marginTop: 21 }}><label className="plain-label" htmlFor="semester-prediction-student">Student</label><select id="semester-prediction-student" className="field-control" value={selected?.id || ''} onChange={(event) => choose(event.target.value)}>{students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.usn}</option>)}</select></div><div className="prediction-fields">{[['attendance', 'Attendance', '%'], ['ia1', 'IA 1 marks', '/ 50'], ['ia2', 'IA 2 marks', '/ 50'], ['assignmentMarks', 'Assignment marks', '/ 20'], ['previousSgpa', 'Previous SGPA', '/ 10'], ['cgpa', 'Current CGPA', '/ 10'], ['backlogs', 'Active backlogs', '']].map(([key, label, suffix]) => <label className="prediction-field" key={key}><span>{label}</span><div><input type="number" value={features[key]} onChange={(event) => update(key, event.target.value)} /><small>{suffix}</small></div></label>)}</div><button className="button-primary full-button" type="button" onClick={predict} disabled={running}><FiZap /> {running ? 'Analysing…' : 'Run XGBoost prediction'}</button></section><section className="content-card prediction-result-card"><p className="page-eyebrow">Latest result · {section ? `Section ${section}` : `Semester ${semester}`}</p>{result && selected ? <><div className="result-student"><Avatar initials={selected.initials} tone={result.risk === 'Low' ? 'mint' : ''} /><div><h2>{selected.name}</h2><p>{selected.usn} · {scope}</p></div></div><div className={`result-risk ${result.risk.toLowerCase()}`}><span>Risk level</span><strong>{result.risk}</strong><RiskBadge risk={result.risk} /></div><div className="probability"><div className="probability-head"><span>Pass probability</span><strong>{result.pass_probability}%</strong></div><div className="probability-track"><i style={{ width: `${result.pass_probability}%` }} /></div><p>{result.pass_probability >= 78 ? 'A positive outlook. Keep the current rhythm going.' : 'A timely conversation could change this trajectory.'}</p></div><div className="result-note"><FiShield /><span>Support signal for this semester, not an automated decision.</span></div></> : <div className="empty-state"><FiActivity /><span>No students available in {scope}.</span></div>}</section></div></div>
}

export default function TeacherSemester() {
  const { user, logout, token } = useAuth()
  const apiSession = !DEMO_MODE && token && token !== LOCAL_SESSION_TOKEN
  const { semester: semesterParam } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const semester = Number(semesterParam)
  const valid = Number.isInteger(semester) && semester >= 1 && semester <= 8
  const routeParts = location.pathname.split('/')
  const activeModule = routeParts[4] || 'dashboard'
  const studentSubroute = routeParts[5] || ''
  const isSectionRoute = activeModule === 'section'
  const section = isSectionRoute ? decodeURIComponent(studentSubroute).trim().toUpperCase() : ''
  const sectionModule = isSectionRoute ? routeParts[6] || 'dashboard' : ''
  const sectionSubroute = isSectionRoute ? routeParts[7] || '' : ''
  const [students, setStudents] = useState(() => valid ? scopedStudents(cloneDemoStudents(), user.department, semester).filter((student) => !section || student.section === section) : [])
  const [sections, setSections] = useState(() => valid ? demoSections.filter((item) => item.department === user.department && Number(item.semester) === semester) : [])
  const [announcements, setAnnouncements] = useState(() => valid ? (section ? scopedSectionAnnouncements(demoAnnouncements, user.department, semester, section) : scopedAnnouncements(demoAnnouncements, user.department, semester)) : [])
  const [messages, setMessages] = useState(() => valid ? (section ? scopedSectionMessages(demoMessages, user.department, semester, section) : scopedMessages(demoMessages, user.department, semester)) : [])
  const [remarks, setRemarks] = useState(() => valid ? demoRemarks.filter((remark) => cloneDemoStudents().some((student) => student.id === remark.studentId && student.department === user.department && student.semester === semester && (!section || student.section === section))) : [])
  const [achievements, setAchievements] = useState(() => valid ? scopedAchievements(demoAchievements, user.department, semester, section) : [])
  const [subjects, setSubjects] = useState(() => valid ? scopedSubjects(getDemoSubjects(), user.department, semester) : [])
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!valid || !apiSession) return undefined
    let mounted = true
    Promise.allSettled([
      api.getSections({ department: user.department, semester }),
      api.getStudents({ department: user.department, semester, section: section || undefined, limit: 100 }),
      api.getAnnouncements({ department: user.department, semester, section: section || undefined }),
      api.getMessages({ department: user.department, semester, section: section || undefined }),
      api.getRemarks({ department: user.department, semester, section: section || undefined }),
      api.getAchievements({ department: user.department, semester, section: section || undefined }),
      api.getSubjects({ department: user.department, semester }),
    ]).then(([sectionResult, studentResult, announcementResult, messageResult, remarkResult, achievementResult, subjectResult]) => {
      if (!mounted) return
      if (sectionResult.status === 'fulfilled' && sectionResult.value?.data) setSections(sectionResult.value.data.filter((item) => item.department === user.department && Number(item.semester) === semester))
      if (studentResult.status === 'fulfilled' && studentResult.value?.data) setStudents(studentResult.value.data.filter((student) => student.department === user.department && Number(student.semester) === semester && (!section || student.section === section)))
      if (announcementResult.status === 'fulfilled' && announcementResult.value?.data) { const items = announcementResult.value.data.filter((item) => item.department === user.department && Number(item.semester) === semester && (!section || item.section === section)); if (items.length) setAnnouncements(items) }
      if (messageResult.status === 'fulfilled' && messageResult.value?.data) { const items = messageResult.value.data.filter((item) => item.department === user.department && Number(item.semester) === semester && (!section || item.section === section)); if (items.length) setMessages(items) }
      if (remarkResult.status === 'fulfilled' && remarkResult.value?.data) { const scopedStudentIds = new Set((studentResult.value?.data || []).filter((student) => student.department === user.department && Number(student.semester) === semester && (!section || student.section === section)).map((student) => Number(student.id))); setRemarks(remarkResult.value.data.filter((remark) => scopedStudentIds.has(Number(remark.studentId)))) }
      if (achievementResult.status === 'fulfilled' && achievementResult.value?.data) { const scopedStudentIds = new Set((studentResult.value?.data || []).filter((student) => student.department === user.department && Number(student.semester) === semester && (!section || student.section === section)).map((student) => Number(student.id))); setAchievements(achievementResult.value.data.filter((achievement) => scopedStudentIds.has(Number(achievement.studentId)))) }
      if (subjectResult.status === 'fulfilled' && subjectResult.value?.data) setSubjects(scopedSubjects(subjectResult.value.data, user.department, semester))
    })
    return () => { mounted = false }
  }, [valid, user.department, semester, section, apiSession])

  useEffect(() => {
    if (!valid || apiSession) return
    setStudents(scopedStudents(cloneDemoStudents(), user.department, semester).filter((student) => !section || student.section === section))
    setAnnouncements(section ? scopedSectionAnnouncements(demoAnnouncements, user.department, semester, section) : scopedAnnouncements(demoAnnouncements, user.department, semester))
    setMessages(section ? scopedSectionMessages(demoMessages, user.department, semester, section) : scopedMessages(demoMessages, user.department, semester))
    setRemarks(demoRemarks.filter((remark) => cloneDemoStudents().some((student) => student.id === remark.studentId && student.department === user.department && Number(student.semester) === semester && (!section || student.section === section))))
    setAchievements(scopedAchievements(demoAchievements, user.department, semester, section))
    setSubjects(scopedSubjects(getDemoSubjects(), user.department, semester))
  }, [valid, user.department, semester, section, apiSession])

  useEffect(() => {
    if (!valid || apiSession) return undefined
    const syncSubjects = () => setSubjects(scopedSubjects(getDemoSubjects(), user.department, semester))
    window.addEventListener('storage', syncSubjects)
    window.addEventListener('camps-subjects-updated', syncSubjects)
    return () => { window.removeEventListener('storage', syncSubjects); window.removeEventListener('camps-subjects-updated', syncSubjects) }
  }, [valid, user.department, semester])

  if (!valid) return <div className="empty-state" style={{ minHeight: '100vh' }}><span>Choose a semester from the teacher workspace.</span></div>
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3000) }
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }
  const sectionBase = section ? `/teacher/semester/${semester}/section/${encodeURIComponent(section)}` : `/teacher/semester/${semester}`
  const navigateModule = (module, id) => {
    if (module === 'student') {
      const record = typeof id === 'object' ? id : students.find((item) => Number(item.id) === Number(id))
      if (record?.usn) {
        const params = new URLSearchParams({ semester: String(semester), section })
        return navigate(`/teacher/student/${encodeURIComponent(record.usn)}?${params.toString()}`)
      }
      return navigate('/teacher/semesters')
    }
    if (module === 'newStudent') return navigate(`${sectionBase}/students/new`)
    if (module === 'uploadStudents') return navigate(`${sectionBase}/students/upload`)
    navigate(module === 'dashboard' ? sectionBase : `${sectionBase}/${module}`)
  }
  const saveNewStudent = async (input) => {
    const scopedInput = { ...input, department: user.department, semester: Number(semester), section: section || input.section }
    const risk = scopedInput.attendance < 70 || scopedInput.cgpa < 6.5 ? 'High' : scopedInput.attendance < 78 || scopedInput.cgpa < 7.2 || scopedInput.backlogs > 0 ? 'Medium' : 'Low'
    const localRecord = { ...scopedInput, id: Date.now(), risk, passProbability: risk === 'Low' ? 92 : risk === 'Medium' ? 73 : 51, initials: scopedInput.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase() }
    let saved = localRecord
    if (apiSession) {
      try { const response = await api.createStudent(scopedInput); saved = response.data || localRecord } catch (error) { if (error.response) { notify(error.response.data?.message || 'Student could not be saved in this section'); return false } notify('API unavailable · student saved locally for this session') }
    }
    setStudents((current) => [saved, ...current])
    notify(`${saved.name} added to Semester ${semester}${section ? ` · Section ${section}` : ''}`)
    navigateModule('students')
  }
  const saveImportedStudents = async (rows, file) => {
    const scopedRows = rows.map((row) => ({ ...row, department: user.department, semester: Number(semester), section: section || row.section }))
    const localRecords = scopedRows.map((row, index) => { const risk = row.attendance < 70 || row.cgpa < 6.5 ? 'High' : row.attendance < 78 || row.cgpa < 7.2 || row.backlogs > 0 ? 'Medium' : 'Low'; return { ...row, id: Date.now() + index, risk, passProbability: risk === 'Low' ? 92 : risk === 'Medium' ? 73 : 51, initials: row.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase() } })
    let savedRecords = localRecords
    if (apiSession) {
      try { const response = await api.uploadStudents(file, true, { department: user.department, semester, section }); savedRecords = (response.data || localRecords).filter((row) => row.department === user.department && Number(row.semester) === semester && (!section || row.section === section)) } catch (error) { if (error.response) { notify(error.response.data?.message || 'Upload validation failed on the server'); return false } notify('API unavailable · roster imported for this session') }
    }
    setStudents((current) => [...savedRecords, ...current])
    notify(`${savedRecords.length} student${savedRecords.length === 1 ? '' : 's'} imported to Semester ${semester}${section ? ` · Section ${section}` : ''}`)
    navigateModule('students')
    return true
  }
  const createAchievement = async (input) => {
    const student = students.find((item) => Number(item.id) === Number(input.studentId))
    if (!student || !section || student.department !== user.department || Number(student.semester) !== semester || String(student.section).toUpperCase() !== section) {
      notify('Choose a student from the current section.')
      return false
    }
    const localRecord = { id: Date.now(), studentId: Number(student.id), studentName: student.name, usn: student.usn, department: user.department, semester, section, achievementType: input.achievementType, date: input.date, title: input.title.trim(), description: input.description.trim(), author: user.name, createdAt: new Date().toISOString() }
    let saved = localRecord
    if (apiSession) {
      try { const response = await api.createAchievement({ ...input, studentId: Number(student.id), department: user.department, semester, section }); saved = response.data || localRecord } catch (error) { if (error.response) { notify(error.response.data?.message || 'Achievement could not be saved in this section'); return false } notify('API unavailable · achievement saved locally for this session') }
    }
    setAchievements((current) => [saved, ...current])
    notify(`${student.name}'s achievement was added to Section ${section}`)
    return true
  }
  const createSection = async (sectionName) => {
    const localSection = { sectionId: `${user.department}-${semester}-${sectionName}-${Date.now()}`, department: user.department, semester, sectionName, studentCount: 0, createdAt: new Date().toISOString() }
    let created = localSection
    if (apiSession) {
      try { const response = await api.createSection({ semester, sectionName }); created = response.data || localSection } catch (error) { notify(error.response?.data?.message || 'Could not create this section'); return false }
    }
    setSections((current) => current.some((item) => item.sectionName === created.sectionName) ? current : [...current, created])
    notify(`Section ${created.sectionName} created for Semester ${semester}`)
    return true
  }
  if (!isSectionRoute) return <SectionSelection user={user} semester={semester} sections={sections} students={students} onCreateSection={createSection} onLogout={signOut} />
  const sectionStudents = students.filter((student) => student.section === section)
  const sectionAnnouncements = announcements.filter((item) => item.section === section)
  const sectionMessages = messages.filter((item) => item.section === section)
  const sidebarModule = sectionModule === 'student' ? 'students' : sectionModule
  let content
  if (sectionModule === 'students' && sectionSubroute === 'new') content = <AddSemesterStudentPage user={user} semester={semester} section={section} students={sectionStudents} onCancel={() => navigateModule('students')} onSave={saveNewStudent} />
  else if (sectionModule === 'students' && sectionSubroute === 'upload') content = <UploadSemesterStudentsPage user={user} semester={semester} section={section} students={sectionStudents} onCancel={() => navigateModule('students')} onImport={saveImportedStudents} />
  else if (sectionModule === 'students') content = <SemesterStudents user={user} semester={semester} section={section} students={sectionStudents} onNavigate={navigateModule} />
  else if (sectionModule === 'attendance') content = <SemesterAttendance user={user} semester={semester} section={section} students={sectionStudents} subjects={subjects} onNavigate={navigateModule} notify={notify} />
  else if (sectionModule === 'marks') content = <SemesterMarks user={user} semester={semester} section={section} students={sectionStudents} subjects={subjects} onNavigate={navigateModule} notify={notify} />
  else if (sectionModule === 'assignments') content = <SemesterAssignments user={user} semester={semester} section={section} students={sectionStudents} onNavigate={navigateModule} />
  else if (sectionModule === 'achievements') content = <SemesterAchievements user={user} semester={semester} section={section} students={sectionStudents} achievements={achievements} onCreateAchievement={createAchievement} onNavigate={navigateModule} />
  else if (sectionModule === 'remarks') content = <SemesterRemarks user={user} semester={semester} section={section} students={sectionStudents} remarks={remarks} onNavigate={navigateModule} />
  else if (sectionModule === 'announcements') content = <SemesterAnnouncements user={user} semester={semester} section={section} announcements={sectionAnnouncements} setAnnouncements={setAnnouncements} notify={notify} />
  else if (sectionModule === 'messages') content = <SemesterMessages user={user} semester={semester} section={section} messages={sectionMessages} setMessages={setMessages} notify={notify} />
  else if (sectionModule === 'analytics') content = <SemesterAnalytics user={user} semester={semester} section={section} students={sectionStudents} />
  else if (sectionModule === 'predictions') content = <SemesterPredictions user={user} semester={semester} section={section} students={sectionStudents} notify={notify} />
  else content = <SemesterDashboard user={user} semester={semester} section={section} students={sectionStudents} subjects={subjects} announcements={sectionAnnouncements} onNavigate={navigateModule} />
  return <TeacherShell user={user} semester={semester} section={section} activeModule={sidebarModule} onLogout={signOut}>{content}{toast && <div className="toast"><FiCheckCircle /> {toast}</div>}</TeacherShell>
}
