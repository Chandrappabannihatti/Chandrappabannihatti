import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowRight, FiCheck, FiChevronRight, FiLock, FiUser, FiUsers } from 'react-icons/fi'
import { departments } from '../data/demo'

const roles = [
  { label: 'Teacher', value: 'teacher', icon: FiUser },
  { label: 'Student', value: 'student', icon: FiUsers },
  { label: 'Parent', value: 'parent', icon: FiUsers },
  { label: 'Admin', value: 'admin', icon: FiLock },
]

function Brand({ light = false }) {
  return (
    <span className="brand-lockup">
      <span className="brand-mark"><span>P</span></span>
      <span className="brand-wordmark">
        <strong style={light ? { color: '#fff' } : undefined}>CAMPS</strong>
        <small style={light ? { color: '#9dadb7' } : undefined}>PES Institute · Shivamogga</small>
      </span>
    </span>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [selectedDepartment, setSelectedDepartment] = useState(null)

  const goToLogin = (role = '') => {
    const params = new URLSearchParams()
    if (selectedDepartment) params.set('department', selectedDepartment.code)
    if (role) params.set('role', role)
    navigate(`/login${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const chooseDepartment = (department) => {
    setSelectedDepartment(department)
    window.setTimeout(() => document.getElementById('role-chooser')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
  }

  return (
    <main className="simple-landing">
      <header className="simple-college-header">
        <div className="simple-header-brand"><Brand /></div>
        <div className="simple-college-copy">
          <p className="simple-overline">CAMPS · Academic portal</p>
          <h1>PES Institute of Technology and Management</h1>
          <p className="simple-address">NH-206, Sagar Road, Shivamogga - 577204</p>
        </div>
      </header>

      <section className="simple-department-section">
        <div className="simple-section-intro">
          <p className="simple-kicker">Academic portal</p>
          <h2>Select your department</h2>
          <p>Choose a department to continue to the right CAMPS workspace.</p>
        </div>
        <div className="simple-department-list">
          {departments.map((department, index) => (
            <button key={department.code} type="button" className={`simple-department-row ${selectedDepartment?.code === department.code ? 'selected' : ''}`} onClick={() => chooseDepartment(department)}>
              <span className="simple-department-number">0{index + 1}</span>
              <span className="simple-department-icon">{department.icon}</span>
              <span className="simple-department-name"><strong>{department.short}</strong><small>{department.name}</small></span>
              <span className="simple-student-count">{department.count} students</span>
              <FiChevronRight className="simple-row-arrow" />
            </button>
          ))}
        </div>

        {selectedDepartment && (
          <div className="simple-role-chooser" id="role-chooser">
            <div>
              <p className="simple-kicker">Department selected</p>
              <h3>{selectedDepartment.code} <span>·</span> Choose your role</h3>
              <p>Continue as a teacher, student, parent or administrator.</p>
            </div>
            <div className="simple-role-list">
              {roles.map(({ label, value, icon: Icon }) => <button key={value} type="button" onClick={() => goToLogin(value)}><Icon /><span>{label}</span><FiArrowRight /></button>)}
            </div>
          </div>
        )}
      </section>

      <footer className="simple-footer"><span><FiCheck /> Secure, department-scoped access</span><span>© 2026 PES Institute of Technology and Management</span></footer>
    </main>
  )
}

export { Brand }
