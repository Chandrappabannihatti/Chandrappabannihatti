import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiArrowRight, FiCheck, FiChevronRight, FiClock, FiCompass, FiMenu, FiShield, FiUsers, FiX } from 'react-icons/fi'
import { departments } from '../data/demo'

const roles = [
  { label: 'Teacher', value: 'teacher', icon: FiCompass },
  { label: 'Student', value: 'student', icon: FiUsers },
  { label: 'Parent', value: 'parent', icon: FiShield },
  { label: 'Admin', value: 'admin', icon: FiCheck },
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
  const [menuOpen, setMenuOpen] = useState(false)

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
    <main className="landing-page">
      <nav className="landing-nav">
        <Link to="/" aria-label="CAMPS home"><Brand /></Link>
        <div className={`nav-links ${menuOpen ? 'mobile-open' : ''}`}>
          <a href="#affiliations" onClick={() => setMenuOpen(false)}>Affiliations</a>
          <a href="#departments" onClick={() => setMenuOpen(false)}>Departments</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About CAMPS</a>
        </div>
        <div className="nav-actions">
          <span className="nav-pill"><i className="dot" /> Academic year 2026–27</span>
          <button className="nav-cta" onClick={() => goToLogin()} type="button">Sign in <FiArrowRight /></button>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation" type="button">
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">Academic intelligence, made human</p>
          <h1 className="hero-title">See the full picture. <em>Shape</em> what comes next.</h1>
          <p className="hero-description">CAMPS brings attendance, assessments and meaningful conversations together—so every student gets the right support before it is needed.</p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={() => document.getElementById('departments')?.scrollIntoView({ behavior: 'smooth' })}>Explore your department <FiArrowRight /></button>
            <button className="secondary-action" type="button" onClick={() => goToLogin()}>Go to portal <FiShield /></button>
          </div>
          <div className="hero-footnote"><FiCheck /> Built for the PES Institute academic community</div>
        </div>
        <div className="hero-visual" aria-label="Live academic pulse summary">
          <div className="pulse-card">
            <div className="pulse-header">
              <div>
                <p className="pulse-kicker">Campus pulse · Semester 7</p>
                <h2 className="pulse-title">Academic health</h2>
              </div>
              <span className="live-tag"><i /> Live view</span>
            </div>
            <div className="pulse-chart">
              <div className="radar-orbit" />
              <div className="radar-line" />
              <div className="pulse-score"><div><strong>82</strong><span>overall index</span></div></div>
              <div className="pulse-pill left"><i className="mini-dot mint" /><span><strong>84.2%</strong><br />attendance</span></div>
              <div className="pulse-pill right"><i className="mini-dot coral" /><span><strong>12</strong><br />need attention</span></div>
            </div>
            <div className="pulse-bottom">
              <span>CSE <strong>·</strong> 124 learners</span>
              <span>Updated <strong>2 min ago</strong></span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="affiliations">
        <div className="section-heading">
          <div><p className="section-label">A trusted academic foundation</p><h2 className="section-title">PES Institute of Technology<br />and Management</h2></div>
          <p className="section-subtitle">NH-206, Sagar Road, Shivamogga – 577204<br />A connected view of the people and progress behind every result.</p>
        </div>
        <div className="affiliation-grid">
          <article className="affiliation-card"><div className="affiliation-top"><span className="affiliation-icon">V</span><span className="affiliation-code">VTU · 01</span></div><h3>VTU Current Affiliation</h3><p>Visvesvaraya Technological University</p></article>
          <article className="affiliation-card"><div className="affiliation-top"><span className="affiliation-icon">V</span><span className="affiliation-code">VTU · 02</span></div><h3>VTU Permanent Affiliation</h3><p>Academic excellence with continuity</p></article>
          <article className="affiliation-card"><div className="affiliation-top"><span className="affiliation-icon">A</span><span className="affiliation-code">AICTE · 03</span></div><h3>AICTE Approval</h3><p>Quality-led technical education</p></article>
        </div>
        <div className="info-band" id="about">
          <article className="info-card primary"><span className="info-icon"><FiCompass /></span><FiArrowRight className="info-arrow" /><h3>College Information</h3><p>One reliable space for the academic community to stay aligned.</p></article>
          <article className="info-card mint"><span className="info-icon"><FiCheck /></span><FiArrowRight className="info-arrow" /><h3>Academic Monitoring</h3><p>Turn daily signals into timely, human support.</p></article>
          <article className="info-card sky"><span className="info-icon"><FiClock /></span><FiArrowRight className="info-arrow" /><h3>Student Performance Prediction</h3><p>Use data to see risk early and act with confidence.</p></article>
          <article className="info-card peach"><span className="info-icon"><FiUsers /></span><FiArrowRight className="info-arrow" /><h3>Parent Communication</h3><p>Keep families in the loop with clarity and care.</p></article>
        </div>
      </section>

      <section className="landing-section department-section" id="departments">
        <div className="department-head">
          <div><p className="section-label">Start with your context</p><h2 className="section-title">Choose a department</h2></div>
          <span className="department-note"><FiShield /> Access is scoped to your department</span>
        </div>
        <div className="department-grid">
          {departments.map((department) => (
            <button key={department.code} type="button" className={`department-card ${selectedDepartment?.code === department.code ? 'selected' : ''}`} onClick={() => chooseDepartment(department)}>
              <span className="dept-icon">{department.icon}</span><FiChevronRight className="dept-arrow" />
              <span className="dept-code">{department.short}</span><span className="dept-name">{department.name}</span>
            </button>
          ))}
        </div>
        {selectedDepartment && (
          <div className="role-chooser" id="role-chooser">
            <div className="role-chooser-copy"><h3>Welcome to <strong>{selectedDepartment.code}</strong></h3><p>Select how you would like to enter the academic workspace.</p></div>
            <div className="role-grid">
              {roles.map(({ label, value, icon: Icon }) => <button key={value} type="button" className="role-button" onClick={() => goToLogin(value)}><Icon /><span>{label}</span></button>)}
            </div>
          </div>
        )}
      </section>

      <footer className="landing-footer"><span>© 2026 CAMPS · PES Institute of Technology and Management</span><span className="footer-right"><span>Privacy</span><span>Support</span><span>System status · Operational</span></span></footer>
    </main>
  )
}

export { Brand }
