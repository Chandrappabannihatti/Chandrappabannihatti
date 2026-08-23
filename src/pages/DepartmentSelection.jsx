import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FiArrowRight, FiCheckCircle, FiChevronRight, FiLock, FiLogOut, FiShield } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { cloneDemoStudents, departments } from '../data/demo'
import { Brand } from './Landing'
import SemesterSelection from './SemesterSelection'

export default function DepartmentSelection() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const students = useMemo(() => cloneDemoStudents(), [])
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }

  return <main className="department-selection-page">
    <header className="selection-topbar"><Brand light /><div className="selection-user"><span className="selection-user-avatar">{user.initials}</span><span><strong>{user.name}</strong><small>{user.department} · Teacher</small></span><button className="selection-logout" type="button" onClick={signOut} aria-label="Sign out"><FiLogOut /></button></div></header>
    <section className="selection-content department-selection-content">
      <div className="selection-heading"><div><p className="page-eyebrow">Teacher workspace</p><h1>Select a department</h1><p>Choose your department before opening a semester. Your account can view and manage records only inside its assigned department.</p></div><span className="selection-scope"><FiShield /> {user.department} scope locked</span></div>
      <div className="department-list">{departments.map((department, index) => {
        const allowed = department.code === user.department
        const count = students.filter((student) => student.department === department.code).length || department.count
        return <button key={department.code} className={`department-list-row ${allowed ? 'available' : 'locked'}`} type="button" disabled={!allowed} onClick={() => navigate(`/teacher/department/${department.code}`)}><span className="department-list-index">0{index + 1}</span><span className={`department-list-icon ${department.tone}`}>{department.icon}</span><span className="department-list-copy"><strong>{department.name}</strong><small>{department.code} · {count} students {allowed ? '· Your department' : '· Restricted for this account'}</small></span>{allowed ? <FiChevronRight className="department-list-chevron" /> : <FiLock className="department-list-lock" />}</button>
      })}</div>
      <div className="selection-note"><FiCheckCircle /><span>Department access is enforced by the teacher session. Semester, section and student data will stay inside <strong>{user.department}</strong>.</span><FiArrowRight /></div>
    </section>
    <footer className="selection-footer"><span>PES Institute of Technology and Management · Shivamogga</span><span>CAMPS · Academic year 2026–27</span></footer>
  </main>
}

export function TeacherDepartment() {
  const { department: departmentParam } = useParams()
  const { user } = useAuth()
  const department = String(departmentParam || '').toUpperCase()
  if (department !== user.department) return <Navigate to="/teacher/departments" replace />
  return <SemesterSelection />
}
