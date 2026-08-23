import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  FiArrowDown,
  FiArrowRight,
  FiArrowUp,
  FiBell,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
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
  FiLogOut,
  FiMail,
  FiMenu,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPlus,
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
  currentUser,
  demoAnnouncements,
  demoMessages,
  demoRemarks,
  demoStudents,
  semesters,
  studentUser,
  subjectPerformance,
} from '../data/demo'
import { Brand } from './Landing'
import api, { DEMO_MODE } from '../lib/api'

const navItems = [
  { key: 'overview', label: 'Overview', icon: FiGrid },
  { key: 'students', label: 'Student records', icon: FiUsers },
  { key: 'prediction', label: 'Prediction desk', icon: FiActivity },
  { key: 'messages', label: 'Messages', icon: FiMessageCircle, badge: 3 },
  { key: 'announcements', label: 'Announcements', icon: FiBell },
  { key: 'remarks', label: 'Teacher remarks', icon: FiEdit3 },
]

const learnerNavItems = [
  { key: 'overview', label: 'My overview', icon: FiGrid },
  { key: 'records', label: 'Academic records', icon: FiBookOpen },
  { key: 'messages', label: 'Messages', icon: FiMessageCircle, badge: 1 },
  { key: 'announcements', label: 'Announcements', icon: FiBell },
]

const riskColors = { Low: '#70B99B', Medium: '#E0B155', High: '#E27D63' }
const pieColors = ['#70B99B', '#E0B155', '#E27D63']

function RiskBadge({ risk }) {
  return <span className={`risk-badge risk-${risk.toLowerCase()}`}>{risk} risk</span>
}

function Avatar({ initials, tone = '' }) {
  return <span className={`avatar ${tone}`}>{initials}</span>
}

function MiniSpark({ color = '#F07E5E' }) {
  return <svg className="kpi-spark" width="70" height="31" viewBox="0 0 70 31" fill="none" aria-hidden="true"><path d="M1 26C8 23 9 20 15 21C21 22 23 10 29 13C35 16 36 20 42 17C48 14 49 5 55 8C61 11 64 5 69 2" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M1 30H69" stroke={color} strokeOpacity=".13" /></svg>
}

function Layout({ user, activeView, onNavigate, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const learner = user.role === 'student' || user.role === 'parent'
  const items = learner ? learnerNavItems : navItems
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
          {items.map(({ key, label, icon: Icon, badge }) => <button key={key} type="button" className={activeView === key ? 'active' : ''} onClick={() => navigate(key)}><Icon /><span>{label}</span>{badge && <span className="sidebar-badge">{badge}</span>}</button>)}
        </div>
        {!learner && <>
          <p className="sidebar-section-label">System</p>
          <div className="sidebar-nav"><button type="button" onClick={() => navigate('settings')} className={activeView === 'settings' ? 'active' : ''}><FiSettings /><span>Workspace settings</span></button></div>
        </>}
        <div className="sidebar-bottom">
          <div className="sidebar-help"><strong><FiHeart style={{ verticalAlign: 'middle', marginRight: 5 }} /> Human-first insight</strong><p>Every alert is a starting point for a better conversation.</p></div>
          <div className="sidebar-profile"><Avatar initials={user.initials || 'CA'} tone={learner ? 'mint' : ''} /><div className="profile-meta"><strong>{user.name}</strong><span>{workspaceLabel}</span></div><button className="logout-btn" type="button" onClick={onLogout} aria-label="Sign out"><FiLogOut /></button></div>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumb"><button className="mobile-sidebar-trigger" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><FiMenu /></button><span>CAMPS</span><FiChevronRight /><strong>{items.find((item) => item.key === activeView)?.label || 'Workspace'}</strong></div><div className="topbar-actions"><button className="topbar-icon" type="button" aria-label="Help"><FiShield /></button><button className="topbar-icon" type="button" aria-label="Notifications"><FiBell /><i className="notification-dot" /></button><span className="topbar-divider" /><div className="topbar-user"><Avatar initials={user.initials || 'CA'} tone={learner ? 'mint' : ''} /><div className="topbar-user-meta"><strong>{user.name}</strong><span>{workspaceLabel}</span></div></div></div></header>
        {children}
      </main>
    </div>
  )
}

function PageIntro({ eyebrow, title, description, actions }) {
  return <div className="page-intro"><div><p className="page-eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{description && <p className="page-subtitle">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

function Overview({ user, students, onNavigate, onAddStudent, onUpload, onExport }) {
  const isAdmin = user.role === 'admin'
  const [selectedSemester, setSelectedSemester] = useState(7)
  const department = isAdmin ? 'All departments' : user.department
  const scopeStudents = useMemo(() => isAdmin ? students : students.filter((student) => student.department === user.department), [isAdmin, students, user.department])
  const semesterStudents = scopeStudents.filter((student) => student.semester === selectedSemester)
  const total = scopeStudents.length
  const avgAttendance = total ? (scopeStudents.reduce((sum, student) => sum + Number(student.attendance || 0), 0) / total).toFixed(1) : '0.0'
  const avgCgpa = total ? (scopeStudents.reduce((sum, student) => sum + Number(student.cgpa || 0), 0) / total).toFixed(1) : '0.0'
  const atRisk = scopeStudents.filter((student) => student.risk === 'High' || student.risk === 'Medium').length
  const riskData = [
    { name: 'Low risk', value: scopeStudents.filter((student) => student.risk === 'Low').length },
    { name: 'Medium risk', value: scopeStudents.filter((student) => student.risk === 'Medium').length },
    { name: 'High risk', value: scopeStudents.filter((student) => student.risk === 'High').length },
  ]
  const alerts = scopeStudents.filter((student) => student.risk === 'High' || student.attendance < 76).slice(0, 3)
  const currentDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date('2026-08-23T10:00:00Z'))

  return <div className="dashboard-content">
    <PageIntro eyebrow={`${department} · Academic year 2026–27`} title={user.role === 'admin' ? 'Good morning, Kavya.' : 'Good morning, Ananya.'} description={`${currentDate}  ·  Here is what needs your attention today.`} actions={<><button type="button" className="button-ghost" onClick={onExport}><FiDownload /> Export report</button>{!isAdmin && <button type="button" className="button-primary" onClick={onAddStudent}><FiPlus /> Add student</button>}</>} />
    <div className="kpi-grid">
      <div className="kpi-card primary"><div className="kpi-top"><span className="kpi-label">Total students</span><span className="kpi-icon"><FiUsers /></span></div><div className="kpi-value">{total || 0}</div><span className="kpi-change"><FiArrowUp /> 8.4% vs last term</span><MiniSpark color="#F07E5E" /></div>
      <div className="kpi-card mint"><div className="kpi-top"><span className="kpi-label">Average attendance</span><span className="kpi-icon"><FiClock /></span></div><div className="kpi-value">{avgAttendance}%</div><span className="kpi-change"><FiArrowUp /> 2.1% this month</span><MiniSpark color="#59A686" /></div>
      <div className="kpi-card sky"><div className="kpi-top"><span className="kpi-label">Average GPA</span><span className="kpi-icon"><FiTrendingUp /></span></div><div className="kpi-value">{avgCgpa}</div><span className="kpi-change"><FiArrowUp /> 0.3 points up</span><MiniSpark color="#6EAAC2" /></div>
      <div className="kpi-card peach"><div className="kpi-top"><span className="kpi-label">Need attention</span><span className="kpi-icon"><FiAlertCircle /></span></div><div className="kpi-value">{atRisk}</div><span className="kpi-change alert"><FiArrowDown /> 3 fewer than last week</span><MiniSpark color="#D96D50" /></div>
    </div>
    <div className="chart-grid">
      <section className="content-card"><div className="card-heading"><div><h2 className="card-title">Attendance rhythm</h2><p className="card-description">How the cohort is showing up over the last seven months</p></div><select className="card-select" defaultValue="all"><option value="all">All semesters</option><option value="7">Semester 7</option><option value="5">Semester 5</option></select></div><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><AreaChart data={attendanceTrend} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}><defs><linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F07E5E" stopOpacity=".26" /><stop offset="100%" stopColor="#F07E5E" stopOpacity=".01" /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis domain={[65, 95]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="target" stroke="#B3C8C0" strokeDasharray="5 5" strokeWidth={1.5} fill="none" /><Area type="monotone" dataKey="attendance" stroke="#F07E5E" strokeWidth={2.5} fill="url(#attendanceGradient)" activeDot={{ r: 5, fill: '#F07E5E', stroke: '#fff', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div></section>
      <section className="content-card"><div className="card-heading"><div><h2 className="card-title">Risk distribution</h2><p className="card-description">Prediction engine snapshot</p></div><span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#70B99B' }} /> This week</span></div><div className="risk-card-content"><div className="risk-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75} paddingAngle={3} stroke="none"><Cell fill={pieColors[0]} /><Cell fill={pieColors[1]} /><Cell fill={pieColors[2]} /></Pie></PieChart></ResponsiveContainer><div className="risk-center"><strong>{total}</strong><span>students</span></div></div><div className="risk-legend">{riskData.map((item, index) => <div className="legend-item" key={item.name}><i className="legend-dot" style={{ background: pieColors[index] }} /><span>{item.name.replace(' risk', '')}</span><strong>{item.value}</strong></div>)}</div></div></section>
    </div>
    <section className="content-card alerts-card"><div className="card-heading"><div><h2 className="card-title">Needs a closer look</h2><p className="card-description">A short list for a more intentional follow-up</p></div><button className="button-ghost" type="button" onClick={() => onNavigate('prediction')}>Open prediction desk <FiArrowRight /></button></div><div className="alert-list">{alerts.length ? alerts.map((student) => <div className="alert-row" key={student.id}><Avatar initials={student.initials} tone={student.risk === 'High' ? '' : 'mint'} /><div className="alert-info"><strong>{student.name}</strong><span>{student.usn} · {student.attendance}% attendance · {student.cgpa} CGPA</span></div><RiskBadge risk={student.risk} /><FiChevronRight className="alert-arrow" /></div>) : <div className="empty-state">No students need attention right now.</div>}</div></section>
    <div className="semester-tabs">{semesters.map((semester) => <button type="button" className={`semester-tab ${semester === selectedSemester ? 'active' : ''}`} key={semester} onClick={() => setSelectedSemester(semester)}>Semester {semester}</button>)}</div>
    <section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">Semester {selectedSemester} students</h2><p className="card-description">{semesterStudents.length} learners in {isAdmin ? 'the current sample view' : `${user.department} · all sections`}</p></div><div className="table-tools"><div className="search-field"><FiSearch /><input placeholder="Search students" aria-label="Search students" /></div><button className="filter-btn" type="button" onClick={() => onNavigate('students')}><FiFilter /> Filter</button></div></div><StudentTable students={semesterStudents.slice(0, 6)} compact onView={(student) => onNavigate('students', student)} /></section>
  </div>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload.find((item) => item.dataKey === 'attendance') || payload[0]
  return <div className="custom-tooltip"><p>{label}</p><strong>{point.value}% attendance</strong></div>
}

function StudentTable({ students, compact = false, onView, onEdit, onDelete }) {
  if (!students.length) return <div className="empty-state"><FiUsers /><span>No students match the selected filters.</span></div>
  return <div className="table-scroll"><table className="student-table"><thead><tr><th>Student</th><th>Semester</th><th>Section</th><th>Attendance</th><th>CGPA</th><th>Risk level</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><div className="student-cell"><Avatar initials={student.initials} tone={student.risk === 'Low' ? 'mint' : ''} /><div><span className="student-name">{student.name}</span><span className="student-usn">{student.usn}</span></div></div></td><td>Sem {student.semester}</td><td>{student.section}</td><td><div className="progress-inline"><span className="progress-track"><i className={`progress-fill ${student.attendance < 75 ? 'danger' : student.attendance < 80 ? 'warn' : ''}`} style={{ width: `${Math.min(student.attendance, 100)}%` }} /></span><span>{student.attendance}%</span></div></td><td><strong style={{ color: '#15263a' }}>{Number(student.cgpa).toFixed(1)}</strong></td><td><RiskBadge risk={student.risk} /></td><td><div className="row-actions"><button className="row-action" type="button" onClick={() => onView?.(student)} aria-label={`View ${student.name}`}><FiEye /></button>{!compact && <><button className="row-action" type="button" onClick={() => onEdit?.(student)} aria-label={`Edit ${student.name}`}><FiEdit3 /></button><button className="row-action" type="button" onClick={() => onDelete?.(student)} aria-label={`Delete ${student.name}`}><FiTrash2 /></button></>}</div></td></tr>)}</tbody></table></div>
}

function StudentsView({ user, students, setStudents, onAddStudent, onUpload, onExport, showToast, selectedStudent, setSelectedStudent }) {
  const admin = user.role === 'admin'
  const [semester, setSemester] = useState(user.role === 'teacher' ? '7' : 'all')
  const [department, setDepartment] = useState(admin ? 'all' : user.department)
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('all')
  const [editing, setEditing] = useState(null)
  const filtered = useMemo(() => students.filter((student) => (admin ? department === 'all' || student.department === department : student.department === user.department) && (semester === 'all' || String(student.semester) === semester) && (risk === 'all' || student.risk === risk) && `${student.name} ${student.usn}`.toLowerCase().includes(query.toLowerCase())), [students, admin, department, user.department, semester, risk, query])
  const saveEdit = async (updated) => { let record = updated; if (!DEMO_MODE) { try { const response = await api.updateStudent(updated.id, updated); record = response.data || updated } catch { showToast('API unavailable · updated locally for this session') } } setStudents((current) => current.map((student) => student.id === record.id ? record : student)); setEditing(null); showToast('Student record updated') }
  const deleteStudent = async (student) => { if (window.confirm(`Remove ${student.name} from the demo roster?`)) { if (!DEMO_MODE) { try { await api.deleteStudent(student.id) } catch { showToast('API unavailable · removed locally for this session') } } setStudents((current) => current.filter((item) => item.id !== student.id)); showToast('Student record removed') } }
  return <div className="dashboard-content"><PageIntro eyebrow="Student management" title="Student records" description="Search, review and maintain the academic roster with confidence." actions={<><button className="button-ghost" type="button" onClick={onExport}><FiDownload /> Export .xlsx</button>{!admin && <><button className="button-ghost" type="button" onClick={onUpload}><FiUploadCloud /> Upload</button><button className="button-primary" type="button" onClick={onAddStudent}><FiPlus /> Manual add</button></>}</>} /><div className="toolbar-card"><div className="search-field"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or USN" aria-label="Search by name or USN" /></div><div className="toolbar-filters"><select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter department"><option value="all">All departments</option><option value="CSE">CSE</option><option value="AIML">AIML</option><option value="CSDS">CSDS</option><option value="ECE">ECE</option><option value="EEE">EEE</option><option value="ME">ME</option><option value="CIVIL">CIVIL</option></select><select value={semester} onChange={(event) => setSemester(event.target.value)} aria-label="Filter semester"><option value="all">All semesters</option>{semesters.map((item) => <option key={item} value={item}>Semester {item}</option>)}</select><select value={risk} onChange={(event) => setRisk(event.target.value)} aria-label="Filter risk"><option value="all">All risk levels</option><option value="Low">Low risk</option><option value="Medium">Medium risk</option><option value="High">High risk</option></select></div></div><section className="content-card table-card"><div className="table-card-head"><div><h2 className="card-title">Roster overview</h2><p className="card-description">Showing {filtered.length} of {students.length} demo records · sorted by USN</p></div><span className="department-note"><FiShield /> {admin ? 'Admin access' : `${user.department} access only`}</span></div><StudentTable students={filtered} onView={setSelectedStudent} onEdit={setEditing} onDelete={deleteStudent} /><div className="table-footer"><span>Showing {filtered.length ? 1 : 0}–{Math.min(filtered.length, 10)} of {filtered.length} students</span><div className="pagination"><button type="button" className="active">1</button><button type="button">2</button><button type="button"><FiChevronRight /></button></div></div></section>{editing && <StudentFormModal student={editing} existingStudents={students} onClose={() => setEditing(null)} onSave={saveEdit} />}{selectedStudent && <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />}</div>
}

function PredictionView({ user, students, showToast }) {
  const scope = user.role === 'admin' ? students : students.filter((student) => student.department === user.department)
  const [selectedId, setSelectedId] = useState(scope[0]?.id || '')
  const selected = scope.find((student) => String(student.id) === String(selectedId)) || scope[0]
  const [features, setFeatures] = useState(selected ? { attendance: selected.attendance, ia1: selected.ia1, ia2: selected.ia2, assignmentMarks: selected.assignmentMarks, previousSgpa: selected.previousSgpa, cgpa: selected.cgpa, backlogs: selected.backlogs } : { attendance: 75, ia1: 30, ia2: 30, assignmentMarks: 15, previousSgpa: 7, cgpa: 7, backlogs: 0 })
  const [prediction, setPrediction] = useState(selected ? { risk: selected.risk, pass_probability: selected.passProbability } : null)
  const [running, setRunning] = useState(false)
  const setFromStudent = (id) => { const next = scope.find((item) => String(item.id) === String(id)); setSelectedId(id); if (next) { setFeatures({ attendance: next.attendance, ia1: next.ia1, ia2: next.ia2, assignmentMarks: next.assignmentMarks, previousSgpa: next.previousSgpa, cgpa: next.cgpa, backlogs: next.backlogs }); setPrediction({ risk: next.risk, pass_probability: next.passProbability }) } }
  const updateFeature = (key, value) => setFeatures((current) => ({ ...current, [key]: Number(value) }))
  const runPrediction = async () => { setRunning(true); let result; if (!DEMO_MODE) { try { result = await api.predict(features) } catch { /* deterministic client fallback below */ } } if (!result) { await new Promise((resolve) => window.setTimeout(resolve, 650)); const score = features.attendance * .38 + ((features.ia1 + features.ia2) / 2) * .25 + features.assignmentMarks * .12 + features.previousSgpa * 4 + features.cgpa * 3 - features.backlogs * 8; const probability = Math.max(24, Math.min(99, Math.round(score))); result = { risk: probability >= 78 ? 'Low' : probability >= 58 ? 'Medium' : 'High', pass_probability: probability } } setPrediction({ risk: result.risk, pass_probability: result.pass_probability }); setRunning(false); showToast('XGBoost-ready prediction refreshed') }
  return <div className="dashboard-content"><PageIntro eyebrow="XGBoost prediction engine" title="Prediction desk" description="Review the signals behind a student’s academic outlook and act early." actions={<span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#70B99B' }} /> Model online · v0.9.4</span>} /><div className="section-grid"><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Run a student prediction</h2><p className="card-description">Seven features feed the pass-probability model.</p></div><span className="prediction-code">POST /api/ml/predict</span></div><div className="form-field" style={{ marginTop: 22 }}><label className="plain-label" htmlFor="prediction-student">Choose student</label><select id="prediction-student" className="field-control" value={selected?.id || ''} onChange={(event) => setFromStudent(event.target.value)}>{scope.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.usn}</option>)}</select></div><div className="prediction-fields">{[['attendance', 'Attendance', '%', 0, 100], ['ia1', 'IA 1 marks', '/ 50', 0, 50], ['ia2', 'IA 2 marks', '/ 50', 0, 50], ['assignmentMarks', 'Assignment marks', '/ 20', 0, 20], ['previousSgpa', 'Previous SGPA', '/ 10', 0, 10], ['cgpa', 'Current CGPA', '/ 10', 0, 10], ['backlogs', 'Active backlogs', '', 0, 10]].map(([key, label, suffix, min, max]) => <label className="prediction-field" key={key}><span>{label}</span><div><input type="number" min={min} max={max} value={features[key]} onChange={(event) => updateFeature(key, event.target.value)} /><small>{suffix}</small></div></label>)}</div><button className="button-primary full-button" type="button" onClick={runPrediction} disabled={running}><FiZap /> {running ? 'Analysing signals…' : 'Run prediction'}</button></section><section className="content-card prediction-result-card"><p className="page-eyebrow">Latest result</p>{prediction && selected ? <><div className="result-student"><Avatar initials={selected.initials} tone={prediction.risk === 'Low' ? 'mint' : ''} /><div><h2>{selected.name}</h2><p>{selected.usn} · Semester {selected.semester}</p></div></div><div className={`result-risk ${prediction.risk.toLowerCase()}`}><span>Risk level</span><strong>{prediction.risk}</strong><RiskBadge risk={prediction.risk} /></div><div className="probability"><div className="probability-head"><span>Pass probability</span><strong>{prediction.pass_probability}%</strong></div><div className="probability-track"><i style={{ width: `${prediction.pass_probability}%` }} /></div><p>{prediction.pass_probability >= 78 ? 'A positive outlook. Keep the current rhythm going.' : 'A timely conversation could change this trajectory.'}</p></div><div className="result-note"><FiShield /><span>Prediction is a support signal, not a label. Pair it with context.</span></div></> : <div className="empty-state"><FiActivity /><span>Select a student to see their result.</span></div>}</section></div><section className="content-card model-note-card"><div className="model-note-icon"><FiZap /></div><div><h3>Ready for XGBoost integration</h3><p>The Node API accepts the same feature contract and forwards to the optional Flask service when <code>ML_SERVICE_URL</code> is configured. This workspace currently uses the deterministic demo fallback.</p></div><span className="model-version">7 features · JSON in / JSON out</span></section></div>
}

function MessagesView({ user, messages, setMessages, showToast, readOnly = false }) {
  const [selectedId, setSelectedId] = useState(messages[0]?.id)
  const [search, setSearch] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const visible = messages.filter((message) => `${message.sender} ${message.recipient} ${message.subject}`.toLowerCase().includes(search.toLowerCase()))
  const selected = messages.find((message) => message.id === selectedId) || visible[0]
  const selectMessage = (message) => { setSelectedId(message.id); setMessages((current) => current.map((item) => item.id === message.id ? { ...item, read: true } : item)) }
  const sendMessage = async (message) => { let saved = { ...message, id: Date.now(), sender: user.name, time: 'Just now', read: true, initials: user.initials }; if (!DEMO_MODE) { try { const response = await api.sendMessage(message); saved = response.data || saved } catch { showToast('API unavailable · message saved locally for this session') } } setMessages((current) => [saved, ...current]); setComposeOpen(false); showToast('Message sent successfully') }
  return <div className="dashboard-content"><PageIntro eyebrow="Keep the loop warm" title="Messages" description="Direct, searchable conversations with students and families." actions={!readOnly && <button className="button-primary" type="button" onClick={() => setComposeOpen(true)}><FiPlus /> New message</button>} /><div className="messages-layout"><div className="message-list"><div className="message-list-head"><h3>Inbox <span style={{ color: '#F07E5E' }}>· {messages.filter((message) => !message.read).length} unread</span></h3>{!readOnly && <button type="button" onClick={() => setComposeOpen(true)} aria-label="Compose message"><FiPlus /></button>}</div><div className="message-search search-field"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inbox" /></div>{visible.map((message) => <button className={`message-item ${selected?.id === message.id ? 'active' : ''}`} type="button" key={message.id} onClick={() => selectMessage(message)}><Avatar initials={message.initials} tone={message.audience === 'Parent' ? 'sky' : ''} /><span className="message-item-content"><span className="message-item-line"><strong>{message.sender}{!message.read && <i className="unread-dot" />}</strong><time>{String(message.time || message.created_at || '').replace('Today, ', '')}</time></span><p>{message.subject}</p></span></button>)}{!visible.length && <div className="empty-state">No messages found.</div>}</div><div className="message-detail">{selected ? <><div className="message-detail-head"><div><h2>{selected.subject}</h2><p>From {selected.sender} · To {selected.recipient} · {selected.time}</p></div><button className="row-action" type="button" aria-label="More message actions"><FiMoreHorizontal /></button></div><div className="message-body"><div className="message-bubble">{selected.body}</div></div>{!readOnly && <div className="message-detail-footer"><input placeholder="Reply to this conversation…" /><button type="button" onClick={() => showToast('Reply composer is ready for your message')} aria-label="Send reply"><FiSend /></button></div>}</> : <div className="empty-state"><FiMail /><span>Select a message to read it.</span></div>}</div></div>{composeOpen && !readOnly && <MessageModal onClose={() => setComposeOpen(false)} onSend={sendMessage} />}</div>
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

function RecordsView({ user, students, onNavigate }) {
  const student = students.find((item) => item.usn === user.usn) || students.find((item) => item.name === user.name) || demoStudents[3]
  return <div className="dashboard-content"><PageIntro eyebrow="Your academic record" title="Academic records" description="A read-only view of your progress across the current academic year." actions={<button className="button-ghost" type="button" onClick={() => onNavigate('overview')}><FiChevronLeft /> Back to overview</button>} /><section className="content-card"><div className="student-detail-hero"><Avatar initials={student.initials} tone="mint" /><div><h2>{student.name}</h2><p>{student.usn} · {student.department} · Semester {student.semester} · Section {student.section}</p></div><span style={{ marginLeft: 'auto' }}><RiskBadge risk={student.risk} /></span></div><div className="info-stat-grid" style={{ marginTop: 20 }}><div className="info-stat"><span>Attendance</span><strong>{student.attendance}%</strong></div><div className="info-stat"><span>Current CGPA</span><strong>{student.cgpa}</strong></div><div className="info-stat"><span>Pass probability</span><strong>{student.passProbability}%</strong></div></div></section><div className="section-grid" style={{ marginTop: 13 }}><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Internal assessment</h2><p className="card-description">Current performance by subject group</p></div></div><div className="chart-container" style={{ height: 250, marginTop: 22 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={subjectPerformance} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="subject" axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="score" radius={[6, 6, 0, 0]}>{subjectPerformance.map((entry) => <Cell key={entry.subject} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div></section><section className="student-detail-card"><h2 className="card-title">Record details</h2><div className="detail-list"><div className="detail-item"><span>IA 1 score</span><strong>{student.ia1} / 50</strong></div><div className="detail-item"><span>IA 2 score</span><strong>{student.ia2} / 50</strong></div><div className="detail-item"><span>Assignments</span><strong>{student.assignmentMarks} / 20</strong></div><div className="detail-item"><span>Previous SGPA</span><strong>{student.previousSgpa} / 10</strong></div><div className="detail-item"><span>Active backlogs</span><strong>{student.backlogs}</strong></div></div></section></div></div>
}

function LearnerOverview({ user, students, announcements, messages, remarks, onNavigate }) {
  const student = students.find((item) => item.usn === user.usn) || demoStudents[3]
  const isParent = user.role === 'parent'
  const relevantRemarks = remarks.filter((remark) => remark.studentId === student.id)
  const relevantMessages = messages.slice(0, 2)
  return <div className="dashboard-content"><PageIntro eyebrow={isParent ? `Family view · ${student.department}` : `${student.department} · Semester ${student.semester}`} title={isParent ? `Hello, ${user.name.split(' ')[0]}.` : `Welcome back, ${student.name.split(' ')[0]}.`} description={isParent ? `Here is the latest academic picture for ${student.name}.` : 'A clear view of your progress, support and next steps.'} actions={<span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#70B99B' }} /> Read-only view</span>} /><div className="info-stat-grid"><div className="info-stat"><span>Attendance</span><strong>{student.attendance}%</strong><span className="kpi-change"><FiArrowUp /> 3.2% this month</span></div><div className="info-stat"><span>Current CGPA</span><strong>{student.cgpa}</strong><span className="kpi-change"><FiArrowUp /> 0.2 points up</span></div><div className="info-stat"><span>Pass probability</span><strong>{student.passProbability}%</strong><span className="kpi-change"><FiCheckCircle /> Model refreshed today</span></div></div><div className="prediction-banner"><div className="prediction-banner-copy"><h3>Academic outlook</h3><p>Based on attendance, internals, assignments and previous SGPA</p></div><div className="prediction-score"><strong>{student.passProbability}%</strong><div><span>pass probability</span><b><i style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#BCE7D7', marginRight: 5 }} />{student.risk} risk</b></div></div></div><div className="section-grid" style={{ marginTop: 13 }}><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Your attendance rhythm</h2><p className="card-description">Consistency is a superpower</p></div></div><div className="chart-container" style={{ height: 210 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={attendanceTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="learnerGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#75BFA5" stopOpacity=".3" /><stop offset="100%" stopColor="#75BFA5" stopOpacity=".02" /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis domain={[55, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="attendance" stroke="#70B99B" strokeWidth={2.5} fill="url(#learnerGradient)" /></AreaChart></ResponsiveContainer></div></section><section className="student-detail-card"><div className="student-detail-hero"><Avatar initials={student.initials} tone="mint" /><div><h2>{student.name}</h2><p>{student.usn} · {student.department}</p></div></div><div className="detail-list"><div className="detail-item"><span>Internal marks</span><strong>{student.ia1 + student.ia2} / 100</strong></div><div className="detail-item"><span>Assignments</span><strong>{student.assignmentMarks} / 20</strong></div><div className="detail-item"><span>Backlogs</span><strong>{student.backlogs === 0 ? 'None' : student.backlogs}</strong></div><div className="detail-item"><span>Mentor</span><strong>Dr. Ananya Rao</strong></div></div></section></div><div className="section-grid" style={{ marginTop: 13 }}><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Teacher remarks</h2><p className="card-description">A little context for your next step</p></div><button className="button-ghost" type="button" onClick={() => onNavigate('messages')}>Open messages <FiArrowRight /></button></div>{relevantRemarks.length ? <div className="alert-list">{relevantRemarks.map((remark) => <div className="alert-row" key={remark.id}><Avatar initials="AR" /><div className="alert-info"><strong>{remark.label}</strong><span>{remark.note}</span></div><span style={{ color: '#a4acab', fontSize: 9 }}>{remark.date}</span></div>)}</div> : <div className="empty-state">No new remarks.</div>}</section><section className="content-card"><div className="card-heading"><div><h2 className="card-title">Latest announcements</h2><p className="card-description">For {student.department} · Semester {student.semester}</p></div><button className="row-action" type="button" onClick={() => onNavigate('announcements')}><FiArrowRight /></button></div><div className="alert-list">{announcements.slice(0, 2).map((announcement) => <div className="alert-row" key={announcement.id}><span className="info-icon" style={{ width: 29, height: 29 }}><FiBell /></span><div className="alert-info"><strong>{announcement.title}</strong><span>{announcement.date}</span></div></div>)}</div></section></div></div>
}

function SettingsView({ user, showToast }) {
  return <div className="dashboard-content"><PageIntro eyebrow="Workspace settings" title="Settings" description="Keep your academic workspace clear, secure and aligned." actions={<button className="button-primary" type="button" onClick={() => showToast('Settings saved for this session')}><FiCheck /> Save changes</button>} /><section className="content-card"><div className="settings-row"><div><h2 className="card-title">Profile & permissions</h2><p className="card-description">Your current identity and access scope</p></div><span className="live-tag" style={{ color: '#4f9276', background: '#eaf6f0', borderColor: '#d7ecdf' }}><i style={{ background: '#70B99B' }} /> JWT secured</span></div><div className="form-grid" style={{ marginTop: 24 }}><div className="form-field"><label className="plain-label">Full name</label><input className="field-control" value={user.name} readOnly /></div><div className="form-field"><label className="plain-label">Role</label><input className="field-control" value={user.role} readOnly /></div><div className="form-field"><label className="plain-label">Email</label><input className="field-control" value={user.email || 'admin@camps.edu'} readOnly /></div><div className="form-field"><label className="plain-label">Access scope</label><input className="field-control" value={user.department === 'ALL' ? 'All departments' : `${user.department} students only`} readOnly /></div></div></section></div>
}

function StudentFormModal({ student, existingStudents = [], onClose, onSave }) {
  const [form, setForm] = useState(student || { usn: '', name: '', department: 'CSE', semester: 7, section: 'A', gender: 'Female', email: '', phone: '', parentName: '', parentPhone: '', attendance: 75, cgpa: 7 })
  const [error, setError] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event) => { event.preventDefault(); if (!form.usn || !form.name || !form.email) { setError('USN, name and email are required.'); return } if (existingStudents.some((item) => item.usn.toUpperCase() === form.usn.toUpperCase() && item.id !== form.id)) { setError('This USN already exists in the roster.'); return } if (form.phone && !/^\+?[0-9 ()-]{10,18}$/.test(form.phone)) { setError('Enter a valid phone number.'); return } const attendance = Number(form.attendance); const cgpa = Number(form.cgpa); const risk = attendance < 70 || cgpa < 6.5 ? 'High' : attendance < 78 || cgpa < 7.2 ? 'Medium' : 'Low'; onSave({ ...form, id: form.id || Date.now(), semester: Number(form.semester), attendance, cgpa, ia1: form.ia1 || 32, ia2: form.ia2 || 34, assignmentMarks: form.assignmentMarks || 15, previousSgpa: form.previousSgpa || cgpa, backlogs: form.backlogs || 0, risk, passProbability: risk === 'Low' ? 90 : risk === 'Medium' ? 72 : 48, initials: form.initials || form.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase() }) }
  return <div className="modal-backdrop"><form className="modal-card wide" onSubmit={submit}><div className="modal-head"><div><h2>{student ? 'Edit student record' : 'Add a student'}</h2><p>Capture the details that power monitoring and prediction.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field"><label className="plain-label">USN</label><input className="field-control" value={form.usn} onChange={(event) => update('usn', event.target.value.toUpperCase())} placeholder="4PM21CS101" required /></div><div className="form-field"><label className="plain-label">Student name</label><input className="field-control" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full name" required /></div><div className="form-field"><label className="plain-label">Department</label><select className="field-control" value={form.department} onChange={(event) => update('department', event.target.value)}><option>CSE</option><option>AIML</option><option>CSDS</option><option>ECE</option><option>EEE</option><option>ME</option><option>CIVIL</option></select></div><div className="form-field"><label className="plain-label">Semester</label><select className="field-control" value={form.semester} onChange={(event) => update('semester', event.target.value)}>{semesters.map((item) => <option key={item}>{item}</option>)}</select></div><div className="form-field"><label className="plain-label">Section</label><select className="field-control" value={form.section} onChange={(event) => update('section', event.target.value)}><option>A</option><option>B</option><option>C</option></select></div><div className="form-field"><label className="plain-label">Gender</label><select className="field-control" value={form.gender} onChange={(event) => update('gender', event.target.value)}><option>Female</option><option>Male</option><option>Other</option></select></div><div className="form-field"><label className="plain-label">Email</label><input className="field-control" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="student@pestrust.edu.in" required /></div><div className="form-field"><label className="plain-label">Phone</label><input className="field-control" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91 98XXX XXXXX" /></div><div className="form-field"><label className="plain-label">Parent name</label><input className="field-control" value={form.parentName} onChange={(event) => update('parentName', event.target.value)} placeholder="Parent / guardian name" /></div><div className="form-field"><label className="plain-label">Parent phone</label><input className="field-control" value={form.parentPhone} onChange={(event) => update('parentPhone', event.target.value)} placeholder="+91 98XXX XXXXX" /></div><div className="form-field"><label className="plain-label">Attendance %</label><input className="field-control" type="number" min="0" max="100" value={form.attendance} onChange={(event) => update('attendance', event.target.value)} /></div><div className="form-field"><label className="plain-label">CGPA</label><input className="field-control" type="number" min="0" max="10" step="0.1" value={form.cgpa} onChange={(event) => update('cgpa', event.target.value)} /></div></div>{error && <div className="validation-error">{error}</div>}</div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit"><FiCheck /> {student ? 'Save changes' : 'Save student'}</button></div></form></div>
}

function StudentDetailModal({ student, onClose }) {
  return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><h2>Student profile</h2><p>Academic snapshot · {student.department} · Semester {student.semester}</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="student-detail-hero"><Avatar initials={student.initials} tone="mint" /><div><h2>{student.name}</h2><p>{student.usn} · Section {student.section} · {student.email}</p></div><span style={{ marginLeft: 'auto' }}><RiskBadge risk={student.risk} /></span></div><div className="info-stat-grid" style={{ marginTop: 18 }}><div className="info-stat"><span>Attendance</span><strong>{student.attendance}%</strong></div><div className="info-stat"><span>CGPA</span><strong>{student.cgpa}</strong></div><div className="info-stat"><span>Pass probability</span><strong>{student.passProbability}%</strong></div></div><div className="mark-bars"><div className="mark-row"><span>IA 1</span><i className="mark-bar"><i style={{ width: `${student.ia1 * 2}%` }} /></i><strong>{student.ia1}</strong></div><div className="mark-row"><span>IA 2</span><i className="mark-bar"><i style={{ width: `${student.ia2 * 2}%` }} /></i><strong>{student.ia2}</strong></div><div className="mark-row"><span>Assign.</span><i className="mark-bar"><i style={{ width: `${student.assignmentMarks * 5}%` }} /></i><strong>{student.assignmentMarks}</strong></div></div><div className="detail-list"><div className="detail-item"><span>Parent / guardian</span><strong>{student.parentName}</strong></div><div className="detail-item"><span>Parent phone</span><strong>{student.parentPhone}</strong></div></div></div><div className="modal-foot"><button className="button-primary" type="button" onClick={onClose}>Done</button></div></div></div>
}

function UploadModal({ onClose, onImport }) {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const readFile = (selectedFile) => { setFile(selectedFile); setErrors([]); const reader = new FileReader(); reader.onload = (event) => { try { const workbook = XLSX.read(event.target.result, { type: 'array' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const parsed = XLSX.utils.sheet_to_json(sheet, { defval: '' }); const normalized = parsed.map((row, index) => ({ id: Date.now() + index, usn: row.USN || row.usn || '', name: row.Name || row.name || '', department: row.Department || row.department || 'CSE', semester: Number(row.Semester || row.semester || 1), section: row.Section || row.section || 'A', email: row.Email || row.email || '', phone: row.Phone || row.phone || '', parentName: row['Parent Name'] || row.parentName || '', parentPhone: row['Parent Phone'] || row.parentPhone || '', attendance: Number(row.Attendance || row.attendance || 0), cgpa: Number(row.CGPA || row.cgpa || 0) })); const validation = []; normalized.forEach((row, index) => { if (!row.usn || !row.name || !row.email) validation.push(`Row ${index + 2}: USN, name and email are required.`); if (row.semester < 1 || row.semester > 8) validation.push(`Row ${index + 2}: semester must be between 1 and 8.`); if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) validation.push(`Row ${index + 2}: invalid email.`) }); setRows(normalized); setErrors(validation) } catch { setRows([]); setErrors(['This file could not be read. Please upload a valid .xlsx or .csv file.']) } }; reader.readAsArrayBuffer(selectedFile) }
  const importRows = () => { if (!rows.length || errors.length) return; onImport(rows); onClose() }
  return <div className="modal-backdrop"><div className="modal-card wide"><div className="modal-head"><div><h2>Upload students</h2><p>Preview, validate and then import your spreadsheet.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body">{!file ? <div className="dropzone"><FiUploadCloud /><div><strong>Drop your roster here</strong><span>Accepted formats: .xlsx, .csv · Required columns: USN, Name, Department, Semester, Email</span><label htmlFor="roster-file">Choose spreadsheet<input id="roster-file" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /></label></div></div> : <><div className="upload-summary"><span><FiFileText style={{ verticalAlign: 'middle', marginRight: 6 }} /> {file.name}</span><strong>{rows.length} rows found</strong></div>{errors.length > 0 && <div className="validation-error">{errors.slice(0, 3).map((error) => <div key={error}>{error}</div>)}{errors.length > 3 && <div>+ {errors.length - 3} more validation errors</div>}</div>}{rows.length > 0 && <div className="table-scroll" style={{ marginTop: 14, border: '1px solid #e9e8e2', borderRadius: 9 }}><table className="student-table" style={{ minWidth: 620 }}><thead><tr><th>USN</th><th>Name</th><th>Department</th><th>Semester</th><th>Attendance</th><th>CGPA</th></tr></thead><tbody>{rows.slice(0, 5).map((row) => <tr key={row.id}><td>{row.usn || '—'}</td><td>{row.name || '—'}</td><td>{row.department}</td><td>{row.semester}</td><td>{row.attendance}%</td><td>{row.cgpa}</td></tr>)}</tbody></table></div>}</>}</div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button>{file && <button className="button-ghost" type="button" onClick={() => { setFile(null); setRows([]); setErrors([]) }}>Choose another</button>}<button className="button-primary" type="button" disabled={!rows.length || errors.length > 0} onClick={importRows}><FiCheck /> Validate & import</button></div></div></div>
}

function MessageModal({ onClose, onSend }) {
  const [form, setForm] = useState({ recipient: 'Student', subject: '', body: '' })
  const send = (event) => { event.preventDefault(); if (!form.subject || !form.body) return; onSend({ ...form, audience: form.recipient, recipient: form.recipient === 'Parent' ? 'Selected parent' : 'Selected student' }) }
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={send}><div className="modal-head"><div><h2>New message</h2><p>Reach a student or family directly.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field"><label className="plain-label">Audience</label><select className="field-control" value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })}><option>Student</option><option>Parent</option><option>Class group</option></select></div><div className="form-field"><label className="plain-label">Recipient</label><select className="field-control"><option>Choose from CSE roster</option><option>Ishita Kulkarni · 4PM21CS033</option><option>Meghana Nayak · 4PM21CS078</option></select></div><div className="form-field full"><label className="plain-label">Subject</label><input className="field-control" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="What would you like them to know?" required /></div><div className="form-field full"><label className="plain-label">Message</label><textarea className="field-control" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write with clarity and care…" required /></div></div></div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit"><FiSend /> Send message</button></div></form></div>
}

function AnnouncementModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', body: '', type: 'Department', department: 'CSE', semester: 7, priority: 'Normal' })
  const create = (event) => { event.preventDefault(); if (!form.title || !form.body) return; onCreate(form) }
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={create}><div className="modal-head"><div><h2>Create announcement</h2><p>Choose an audience and make the next step visible.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field full"><label className="plain-label">Title</label><input className="field-control" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Project review tomorrow" required /></div><div className="form-field"><label className="plain-label">Visibility</label><select className="field-control" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>College</option><option>Department</option><option>Semester</option></select></div><div className="form-field"><label className="plain-label">Priority</label><select className="field-control" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Normal</option><option>Medium</option><option>High</option></select></div>{form.type !== 'College' && <div className="form-field"><label className="plain-label">Department</label><select className="field-control" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}><option>CSE</option><option>AIML</option><option>CSDS</option><option>ECE</option></select></div>}{form.type === 'Semester' && <div className="form-field"><label className="plain-label">Semester</label><select className="field-control" value={form.semester} onChange={(event) => setForm({ ...form, semester: Number(event.target.value) })}>{semesters.map((item) => <option key={item}>{item}</option>)}</select></div>}<div className="form-field full"><label className="plain-label">Message</label><textarea className="field-control" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write the announcement details…" required /></div></div></div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit"><FiBell /> Publish announcement</button></div></form></div>
}

function RemarkModal({ students, onClose, onCreate }) {
  const [form, setForm] = useState({ studentId: students[0]?.id || '', label: 'Needs Improvement', note: '' })
  const save = (event) => { event.preventDefault(); if (!form.note) return; onCreate(form) }
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={save}><div className="modal-head"><div><h2>Add teacher remark</h2><p>Your context will be visible to the student and parent.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="modal-body"><div className="form-grid"><div className="form-field full"><label className="plain-label">Student</label><select className="field-control" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>{students.filter((student) => student.department === 'CSE').map((student) => <option value={student.id} key={student.id}>{student.name} · {student.usn}</option>)}</select></div><div className="form-field full"><label className="plain-label">Remark type</label><select className="field-control" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })}><option>Excellent Performance</option><option>Needs Improvement</option><option>Good Participation</option><option>Low Attendance</option><option>Outstanding Student</option></select></div><div className="form-field full"><label className="plain-label">Observation</label><textarea className="field-control" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Add one specific, useful next step…" required /></div></div></div><div className="modal-foot"><button className="button-ghost" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit"><FiCheck /> Save remark</button></div></form></div>
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState('overview')
  const [students, setStudents] = useState(() => cloneDemoStudents())
  const [messages, setMessages] = useState(() => demoMessages.map((item) => ({ ...item })))
  const [announcements, setAnnouncements] = useState(() => demoAnnouncements.map((item) => ({ ...item })))
  const [remarks, setRemarks] = useState(() => demoRemarks.map((item) => ({ ...item })))
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [toast, setToast] = useState('')
  const isLearner = user.role === 'student' || user.role === 'parent'

  useEffect(() => {
    if (DEMO_MODE || !user) return undefined
    let mounted = true
    Promise.allSettled([
      api.getStudents({ limit: 100 }),
      api.getMessages(),
      api.getAnnouncements(),
      api.getRemarks(),
    ]).then(([studentResult, messageResult, announcementResult, remarkResult]) => {
      if (!mounted) return
      if (studentResult.status === 'fulfilled' && studentResult.value?.data) setStudents(studentResult.value.data)
      if (messageResult.status === 'fulfilled' && messageResult.value?.data) setMessages(messageResult.value.data)
      if (announcementResult.status === 'fulfilled' && announcementResult.value?.data) setAnnouncements(announcementResult.value.data)
      if (remarkResult.status === 'fulfilled' && remarkResult.value?.data) setRemarks(remarkResult.value.data)
    })
    return () => { mounted = false }
  }, [user])

  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3000) }
  const exportStudents = () => { const rows = students.map(({ id, initials, risk, passProbability, ...student }) => student); const worksheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Students'); XLSX.writeFile(workbook, 'camps-student-roster.xlsx'); showToast('Roster exported as camps-student-roster.xlsx') }
  const importStudents = async (rows) => { const mapped = rows.map((row) => { const attendance = Number(row.attendance || 0); const cgpa = Number(row.cgpa || 0); const risk = attendance < 70 || cgpa < 6.5 ? 'High' : attendance < 78 || cgpa < 7.2 ? 'Medium' : 'Low'; return { ...row, id: Date.now() + Math.random(), semester: Number(row.semester), attendance, cgpa, risk, passProbability: risk === 'Low' ? 92 : risk === 'Medium' ? 73 : 51, initials: row.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase(), ia1: 30, ia2: 32, assignmentMarks: 15, previousSgpa: cgpa, backlogs: 0 } }); let savedRows = mapped; if (!DEMO_MODE) { const responses = await Promise.all(mapped.map(async (row) => { try { const response = await api.createStudent(row); return response.data || row } catch { return row } })); savedRows = responses } setStudents((current) => [...savedRows, ...current]); showToast(`${savedRows.length} student${savedRows.length === 1 ? '' : 's'} imported`) }
  const saveNewStudent = async (student) => { let saved = student; if (!DEMO_MODE) { try { const response = await api.createStudent(student); saved = response.data || student } catch { showToast('API unavailable · saved locally for this session') } } setStudents((current) => [saved, ...current]); setStudentModalOpen(false); showToast('Student saved to the roster') }
  const navigateView = (view) => setActiveView(view)
  const signOut = async () => { await logout(); navigate('/') }

  const renderContent = () => {
    if (user.role === 'student' || user.role === 'parent') {
      if (activeView === 'records') return <RecordsView user={user} students={students} onNavigate={navigateView} />
      if (activeView === 'messages') return <MessagesView user={user} messages={messages} setMessages={setMessages} showToast={showToast} readOnly />
      if (activeView === 'announcements') return <AnnouncementsView announcements={announcements} setAnnouncements={setAnnouncements} user={user} showToast={showToast} readOnly />
      return <LearnerOverview user={user} students={students} announcements={announcements} messages={messages} remarks={remarks} onNavigate={navigateView} />
    }
    if (activeView === 'students') return <StudentsView user={user} students={students} setStudents={setStudents} onAddStudent={() => setStudentModalOpen(true)} onUpload={() => setUploadOpen(true)} onExport={exportStudents} showToast={showToast} selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent} />
    if (activeView === 'prediction') return <PredictionView user={user} students={students} showToast={showToast} />
    if (activeView === 'messages') return <MessagesView user={user} messages={messages} setMessages={setMessages} showToast={showToast} />
    if (activeView === 'announcements') return <AnnouncementsView announcements={announcements} setAnnouncements={setAnnouncements} user={user} showToast={showToast} />
    if (activeView === 'remarks') return <RemarksView remarks={remarks} setRemarks={setRemarks} students={students} user={user} showToast={showToast} />
    if (activeView === 'settings') return <SettingsView user={user} showToast={showToast} />
    return <Overview user={user} students={students} onNavigate={navigateView} onAddStudent={() => setStudentModalOpen(true)} onUpload={() => setUploadOpen(true)} onExport={exportStudents} />
  }

  return <Layout user={user} activeView={activeView} onNavigate={navigateView} onLogout={signOut}>{renderContent()}{!isLearner && studentModalOpen && <StudentFormModal existingStudents={students} onClose={() => setStudentModalOpen(false)} onSave={saveNewStudent} />}{!isLearner && uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onImport={importStudents} />}{toast && <div className="toast"><FiCheckCircle /> {toast}</div>}</Layout>
}
