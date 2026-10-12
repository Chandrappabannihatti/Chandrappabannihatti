import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiLogOut, FiPlus, FiSettings, FiShield, FiUser, FiUsers, FiX } from 'react-icons/fi'
import { Brand } from './Landing'
import BackButton from '../components/BackButton'

export default function SectionSelection({ user, semester, sections = [], students = [], onCreateSection, onLogout }) {
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const [error, setError] = useState('')
  const displaySections = [...sections].sort((a, b) => String(a.sectionName || '').localeCompare(String(b.sectionName || ''), undefined, { numeric: true }))
  const scopeLabel = `${user.department} · Semester ${semester}`

  const studentCount = (section) => {
    const count = Number(section.studentCount)
    // The API's COUNT(students.id) is authoritative, including zero. The
    // local roster fallback is retained for the explicitly configured demo
    // mode and for older section records without a count field.
    return Number.isFinite(count) && section.studentCount !== null && section.studentCount !== undefined
      ? count
      : students.filter((student) => String(student.section).toUpperCase() === String(section.sectionName).toUpperCase()).length
  }

  const submit = async (event) => {
    event.preventDefault()
    const normalized = sectionName.trim().toUpperCase()
    if (!normalized) { setError('Enter a section name such as D.'); return }
    if (!/^[A-Z0-9][A-Z0-9 -]{0,9}$/.test(normalized)) { setError('Use up to 10 letters or numbers, for example Section D.'); return }
    if (displaySections.some((section) => String(section.sectionName).toUpperCase() === normalized)) { setError(`Section ${normalized} already exists for this semester.`); return }
    const created = await onCreateSection(normalized)
    if (created) { setSectionName(''); setError(''); setAddOpen(false) }
  }

  const signOut = async () => { await onLogout(); navigate('/', { replace: true }) }

  return <main className="section-selection-page">
    <header className="selection-topbar"><Brand light /><div className="selection-user"><span className="selection-user-avatar">{user.initials || 'T'}</span><span><strong>{user.name}</strong><small>{user.department} · Teacher</small></span><div className="selection-account-links"><button type="button" onClick={() => navigate('/teacher/profile')}><FiUser /> Profile</button><button type="button" onClick={() => navigate('/teacher/settings')}><FiSettings /> Settings</button></div><button className="selection-logout" type="button" onClick={signOut} aria-label="Sign out"><FiLogOut /></button></div></header>
    <section className="selection-content section-selection-content" aria-labelledby="section-selection-title">
      <BackButton fallbackPath="/teacher/semesters" />
      <div className="section-selection-hero">
        <div className="section-selection-hero-copy">
          <p className="page-eyebrow">Teacher workspace · Section management</p>
          <h1 id="section-selection-title">Select a Section</h1>
          <p>Open a focused academic workspace for one class. Students, attendance, marks, communication and predictions remain scoped to the selected section.</p>
        </div>
        <div className="section-selection-context" aria-label={`Selected scope ${scopeLabel}`}>
          <span><FiShield /> Selected scope</span>
          <strong>{scopeLabel}</strong>
          <small>Department and semester access are locked to your teacher scope.</small>
        </div>
      </div>

      <div className="section-selection-toolbar">
        <div><p className="simple-kicker">Step 2 · Choose class group</p><h2>Available sections</h2><p>{displaySections.length ? `${displaySections.length} section${displaySections.length === 1 ? '' : 's'} available for ${scopeLabel}.` : `No sections have been created for ${scopeLabel} yet.`}</p></div>
        <button className="section-add-button" type="button" onClick={() => { setAddOpen((value) => !value); setError('') }}><FiPlus /> Add Section</button>
      </div>

      {addOpen && <form className="section-add-form" onSubmit={submit}><div><label htmlFor="new-section-name">New section name</label><input id="new-section-name" value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder="D" autoFocus /><span>Stored under {scopeLabel}</span></div><button className="section-add-save" type="submit"><FiCheckCircle /> Save section</button>{error && <p className="section-add-error" role="alert">{error}</p>}<button className="section-add-close" type="button" onClick={() => { setAddOpen(false); setError('') }} aria-label="Close add section form"><FiX /></button></form>}

      <div className="section-card-grid" aria-label={`Sections for ${scopeLabel}`}>
        {displaySections.map((section, index) => {
          const name = String(section.sectionName || '').toUpperCase()
          const count = studentCount(section)
          return <button className="section-card" key={section.sectionId || `${section.department}-${section.semester}-${name}`} type="button" onClick={() => navigate(`/teacher/semester/${semester}/section/${encodeURIComponent(name)}`)} aria-label={`Open Section ${name}, ${count} ${count === 1 ? 'student' : 'students'}`}>
            <span className="section-card-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="section-card-letter" aria-hidden="true">{name || '?'}</span>
            <span className="section-card-content"><span className="section-card-kicker">Section {name || 'Not provided'}</span><strong>{count}</strong><span className="section-card-student-label"><FiUsers /> {count === 1 ? 'student enrolled' : 'students enrolled'}</span><span className="section-card-meta"><span><FiShield /> {user.department}</span><span><FiBookOpen /> Semester {semester}</span></span></span>
            <span className="section-card-arrow" aria-hidden="true"><FiArrowRight /></span>
          </button>
        })}
        {!displaySections.length && <div className="section-empty"><FiPlus /><span>No sections yet. Use <strong>Add Section</strong> to create the first class group for Semester {semester}.</span></div>}
      </div>
      <div className="selection-note"><FiCheckCircle /><span>Each section opens its own students, attendance, internal marks, assignments, achievements, remarks, messages, announcements and predictions.</span><FiArrowRight /></div>
    </section>
    <footer className="selection-footer"><span>PES Institute of Technology and Management · Shivamogga</span><span>CAMPS · Academic year 2026–27</span></footer>
  </main>
}
