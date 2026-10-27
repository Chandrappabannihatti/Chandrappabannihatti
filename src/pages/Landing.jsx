import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowRight, FiCheck } from 'react-icons/fi'
import { departmentCards, decorateDepartmentRows } from '../data/departments'
import api, { DEMO_MODE } from '../lib/api'

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
  const [departments, setDepartments] = useState(departmentCards)

  useEffect(() => {
    if (DEMO_MODE) return undefined
    let mounted = true
    api.getLoginDepartments().then((response) => {
      const configured = decorateDepartmentRows(response?.data)
      if (mounted && configured.length) setDepartments(configured)
    }).catch((error) => {
      console.warn('[camps-auth] Login department catalog unavailable; keeping the configured UI fallback.', { status: error.response?.status || 'network', message: error.response?.data?.message || error.message })
    })
    return () => { mounted = false }
  }, [])

  const chooseDepartment = (department) => {
    navigate(`/login?department=${encodeURIComponent(department.code)}`)
  }

  return (
    <main className="erp-entry-page">
      <header className="erp-entry-header"><Brand /><span className="erp-entry-badge"><i /> Secure university ERP</span></header>
      <section className="erp-department-section" aria-labelledby="department-heading">
        <div className="erp-step-heading"><span className="erp-step-label">Step 1</span><h1 id="department-heading">Select Your Department</h1><p>Choose your department to continue to secure login</p></div>
        <div className="erp-department-grid">
          {departments.map((department) => <button key={department.code} type="button" className="erp-department-card" onClick={() => chooseDepartment(department)}><span className="erp-card-orbit" aria-hidden="true" /><span className={`erp-department-icon ${department.tone}`} aria-hidden="true">{department.icon}</span><span className="erp-department-copy"><span className="erp-department-code">{department.label}</span><strong>{department.name}</strong><small>{department.tagline}</small></span><span className="erp-department-action">Continue to Login <FiArrowRight /></span></button>)}
        </div>
      </section>
      <footer className="erp-entry-footer"><span><FiCheck /> Department-scoped access</span><span>© 2026 PES Institute of Technology and Management</span></footer>
    </main>
  )
}

export { Brand }
