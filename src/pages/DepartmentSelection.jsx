import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FiArrowRight, FiChevronRight, FiLogOut } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { cloneDemoStudents } from '../data/demo'
import { Brand } from './Landing'
import SemesterSelection from './SemesterSelection'

const departmentCards = [
  { accessCode: 'CSE', code: 'CSE', name: 'Computer Science & Engineering', tagline: 'Code. Create. Innovate.', icon: '💻', tone: 'coral' },
  { accessCode: 'AIML', code: 'AIML', name: 'Artificial Intelligence & ML', tagline: 'Intelligence for tomorrow.', icon: '🤖', tone: 'mint' },
  { accessCode: 'CSDS', code: 'CSDS', name: 'Computer Science & Data Science', tagline: 'Turn data into decisions.', icon: '📊', tone: 'sky' },
  { accessCode: 'CE', code: 'CE', name: 'Computer Engineering', tagline: 'Design powerful systems.', icon: '🏗️', tone: 'teal' },
  { accessCode: 'CIVIL', code: 'CV', name: 'Civil Engineering', tagline: 'Build the world around us.', icon: '🌉', tone: 'peach' },
  { accessCode: 'ME', code: 'ME', name: 'Mechanical Engineering', tagline: 'Engineer motion and machines.', icon: '⚙️', tone: 'lavender' },
  { accessCode: 'EEE', code: 'EEE', name: 'Electrical & Electronics', tagline: 'Power ideas into life.', icon: '⚡', tone: 'yellow' },
  { accessCode: 'ECE', code: 'ECE', name: 'Electronics & Communication', tagline: 'Connect a smarter future.', icon: '📡', tone: 'slate' },
]

export default function DepartmentSelection() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const students = useMemo(() => cloneDemoStudents(), [])
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }

  return <main className="department-selection-page">
    <header className="department-selection-toolbar"><Brand /><div className="department-account"><span className="department-account-avatar">{user.initials}</span><span><strong>{user.name}</strong><small>{user.department} · Teacher</small></span><button className="department-account-logout" type="button" onClick={signOut} aria-label="Sign out"><FiLogOut /></button></div></header>
    <section className="department-selection-content" aria-labelledby="department-selection-title">
      <h1 id="department-selection-title" className="sr-only">Choose a department</h1>
      <div className="department-list">{departmentCards.map((department) => {
        const allowed = department.accessCode === user.department
        const count = students.filter((student) => student.department === department.accessCode).length
        return <button key={department.code} className={`department-list-row ${allowed ? 'available' : 'locked'}`} type="button" disabled={!allowed} aria-label={allowed ? `Choose ${department.name}` : `${department.name} is outside your ${user.department} teacher scope`} onClick={() => navigate(`/teacher/department/${department.accessCode}`)}><span className={`department-card-orbit ${allowed ? 'active' : ''}`} aria-hidden="true" /><span className={`department-list-icon ${department.tone}`} aria-hidden="true">{department.icon}</span><span className="department-list-copy"><span className="department-list-code">{department.code}</span><strong>{department.name}</strong><small>{department.tagline}</small></span><span className="department-card-link">Choose department <FiArrowRight /></span>{count > 0 && <span className="sr-only">{count} demo students</span>}</button>
      })}</div>
    </section>
  </main>
}

export function TeacherDepartment() {
  const { department: departmentParam } = useParams()
  const { user } = useAuth()
  const department = String(departmentParam || '').toUpperCase()
  if (department !== user.department) return <Navigate to="/teacher/departments" replace />
  return <SemesterSelection />
}
