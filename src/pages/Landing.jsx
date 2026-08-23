import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowRight, FiCheck, FiChevronRight, FiLock, FiUser, FiUsers } from 'react-icons/fi'
import { departmentCards } from '../data/departments'

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
  const [selectedRole, setSelectedRole] = useState('')

  const goToLogin = (role = selectedRole) => {
    if (!selectedDepartment || !role) return
    const params = new URLSearchParams({ department: selectedDepartment.code, role })
    navigate(`/login?${params.toString()}`)
  }

  const chooseDepartment = (department) => {
    setSelectedDepartment(department)
    setSelectedRole('')
    window.setTimeout(() => document.getElementById('role-chooser')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
  }

  return (
    <main className="erp-entry-page">
      <header className="erp-entry-header"><Brand /><span className="erp-entry-badge"><i /> Secure university ERP</span></header>
      <section className="erp-department-section" aria-labelledby="department-heading">
        <div className="erp-step-heading"><span className="erp-step-label">Step 1</span><h1 id="department-heading">Select Your Department</h1><p>Choose your department to continue</p></div>
        <div className="erp-department-grid">
          {departmentCards.map((department) => <button key={department.code} type="button" className={`erp-department-card ${selectedDepartment?.code === department.code ? 'selected' : ''}`} onClick={() => chooseDepartment(department)}><span className="erp-card-orbit" aria-hidden="true" /><span className={`erp-department-icon ${department.tone}`} aria-hidden="true">{department.icon}</span><span className="erp-department-copy"><span className="erp-department-code">{department.label}</span><strong>{department.name}</strong><small>{department.tagline}</small></span><span className="erp-department-action">Choose Department <FiArrowRight /></span></button>)}
        </div>
        {selectedDepartment && <section className="erp-role-section" id="role-chooser" aria-labelledby="role-heading"><div className="erp-role-copy"><span className="erp-step-label">Step 2</span><h2 id="role-heading">Choose your role</h2><p>Selected Department: <strong>{selectedDepartment.label}</strong></p></div><div className="erp-role-tabs" role="tablist" aria-label="Choose your role">{roles.map(({ label, value, icon: Icon }) => <button key={value} type="button" role="tab" aria-selected={selectedRole === value} className={selectedRole === value ? 'active' : ''} onClick={() => setSelectedRole(value)}><Icon /><span>{label}</span></button>)}</div>{selectedRole && <div className="erp-login-continue"><span><strong>{selectedDepartment.label}</strong> <FiChevronRight /> {roles.find((role) => role.value === selectedRole)?.label} Login</span><button type="button" onClick={() => goToLogin()}><span>Continue to login</span><FiArrowRight /></button></div>}</section>}
      </section>
      <footer className="erp-entry-footer"><span><FiCheck /> Department-scoped access</span><span>© 2026 PES Institute of Technology and Management</span></footer>
    </main>
  )
}

export { Brand }
