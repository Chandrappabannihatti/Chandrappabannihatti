import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiChevronRight, FiLogOut, FiShield } from 'react-icons/fi'
import { cloneDemoStudents, semesters } from '../data/demo'
import { useAuth } from '../context/AuthContext'
import { Brand } from './Landing'

const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export default function SemesterSelection() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const students = useMemo(() => cloneDemoStudents().filter((student) => student.department === user.department), [user.department])

  const signOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return <main className="semester-selection-page">
    <header className="selection-topbar"><Brand light /><div className="selection-user"><span className="selection-user-avatar">{user.initials}</span><span><strong>{user.name}</strong><small>{user.department} · Teacher</small></span><button className="selection-logout" type="button" onClick={signOut} aria-label="Sign out"><FiLogOut /></button></div></header>
    <section className="selection-content">
      <button className="selection-back-link" type="button" onClick={() => navigate('/teacher/departments')}><FiArrowLeft /> Change department</button>
      <div className="selection-heading"><div><p className="page-eyebrow">Teacher workspace · {user.department}</p><h1>Select a semester</h1><p>Choose one semester to open its dedicated academic dashboard. Your view is limited to {user.department} students.</p></div><span className="selection-scope"><FiShield /> Department-scoped access</span></div>
      <div className="selection-list">{semesters.map((semester, index) => { const count = students.filter((student) => student.semester === semester).length; return <button key={semester} className="selection-semester-row" type="button" onClick={() => navigate(`/teacher/semester/${semester}`)}><span className="selection-semester-index">0{index + 1}</span><span className="selection-semester-badge">{ordinals[index]}</span><span className="selection-semester-copy"><strong>Semester {semester}</strong><small>{count} {count === 1 ? 'student' : 'students'} in {user.department}</small></span><FiChevronRight className="selection-chevron" /></button> })}</div>
      <div className="selection-note"><FiCheckCircle /><span>Each semester opens its own section chooser before any section-level students, attendance, marks, communication or XGBoost data is shown.</span><FiArrowRight /></div>
    </section>
    <footer className="selection-footer"><span>PES Institute of Technology and Management · Shivamogga</span><span>CAMPS · Academic year 2026–27</span></footer>
  </main>
}
