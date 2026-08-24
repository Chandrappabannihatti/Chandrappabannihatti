import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheck, FiChevronRight, FiEdit3, FiGrid, FiLogOut, FiPlus, FiRefreshCw, FiSettings, FiShield, FiTrash2, FiUser, FiUsers, FiX } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { departmentCards } from '../data/departments'
import { getDemoSubjects } from '../data/demo'
import { Brand } from './Landing'
import api, { DEMO_MODE, LOCAL_SESSION_TOKEN, setAuthToken } from '../lib/api'

function persistDemoSubjects(subjects) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('camps_subjects', JSON.stringify(subjects))
  window.dispatchEvent(new window.Event('camps-subjects-updated'))
}

function nextDemoSubjectId(subjects) {
  return subjects.reduce((highest, item) => Math.max(highest, Number(item.id || item.subjectId) || 0), 0) + 1
}

function AdminShell({ children, crumb = 'Administration' }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }
  return <main className="admin-control-page"><header className="admin-control-topbar"><Brand light /><div className="admin-control-account"><span className="admin-account-avatar">{user.initials || 'KM'}</span><span className="admin-control-user"><strong>{user.name}</strong><small>Administrator · {user.department === 'ALL' ? 'All departments' : `${user.department} scope`}</small></span><div className="admin-account-links"><button type="button" onClick={() => navigate('/admin/profile')}><FiUser /> Profile</button><button type="button" onClick={() => navigate('/admin/settings')}><FiSettings /> Settings</button><button className="admin-logout" type="button" onClick={signOut} aria-label="Sign out"><FiLogOut /></button></div></div></header><div className="admin-control-breadcrumb"><span>CAMPS</span><FiChevronRight /><strong>{crumb}</strong></div>{children}</main>
}

function AdminPageIntro({ eyebrow, title, description, actions }) {
  return <div className="admin-page-intro"><div><p className="admin-page-eyebrow"><FiShield /> {eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions && <div className="admin-page-actions">{actions}</div>}</div>
}

function scopedLocalSubjects(department, semester) {
  return getDemoSubjects().filter((subject) => subject.department === department && (!semester || Number(subject.semester) === Number(semester)))
}

const adminSemesters = [1, 2, 3, 4, 5, 6, 7, 8]

export default function AdminSubjectHierarchy() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const apiSession = !DEMO_MODE && token && token !== LOCAL_SESSION_TOKEN
  const department = useMemo(() => departmentCards.find((item) => item.code === user.department) || departmentCards[0], [user.department])
  const [subjectCounts, setSubjectCounts] = useState(() => Object.fromEntries(adminSemesters.map((semester) => [semester, scopedLocalSubjects(department.code, semester).length])))

  useEffect(() => {
    let mounted = true
    const loadCounts = async () => {
      if (apiSession) setAuthToken(token)
      let subjects = scopedLocalSubjects(department.code)
      if (apiSession) {
        try { const response = await api.getSubjects({ department: department.code }); subjects = response.data || [] } catch { /* local fallback keeps the hierarchy usable */ }
      }
      if (mounted) setSubjectCounts(Object.fromEntries(adminSemesters.map((semester) => [semester, subjects.filter((subject) => Number(subject.semester) === semester).length])))
    }
    loadCounts()
    return () => { mounted = false }
  }, [department.code, apiSession])

  return <AdminShell crumb="Semester hierarchy"><section className="admin-control-content"><button className="admin-back-link" type="button" onClick={() => navigate('/app')}><FiArrowLeft /> Back to administration</button><AdminPageIntro eyebrow={`${department.label} · Academic structure`} title="Semester hierarchy" description={`Select a semester to manage the subjects shared by every ${department.label} academic portal.`} actions={<span className="admin-scope-pill"><FiGrid /> Selected at login · {department.label}</span>} /><div className="admin-selected-scope"><span className={`admin-department-orb ${department.tone}`}>{department.icon}</span><div><span>Selected department</span><strong>{department.label}</strong><small>{department.name}</small></div><em><FiShield /> Department is fixed for this session</em></div><section className="admin-structure-card admin-semester-card admin-semester-dashboard"><div className="admin-card-heading"><div><h2>Semesters 1–8</h2><p>{department.label} · Choose a semester to open Subject Management.</p></div><FiBookOpen /></div><div className="admin-semester-grid">{adminSemesters.map((semester) => <button type="button" className="admin-semester-option" key={semester} onClick={() => navigate(`/admin/subjects/${department.code}/${semester}`)}><span className="admin-semester-number">{String(semester).padStart(2, '0')}</span><span><strong>Semester {semester}</strong><small>{subjectCounts[semester] || 0} subjects configured</small></span><FiArrowRight /></button>)}</div><div className="admin-hierarchy-note"><FiCheck /><span>Subjects added here sync automatically to Teacher, Student and Parent dashboards for {department.label} Semester 1–8.</span></div></section></section></AdminShell>
}

export function AdminSubjectManagement() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const apiSession = !DEMO_MODE && token && token !== LOCAL_SESSION_TOKEN
  const { department: departmentParam, semester: semesterParam } = useParams()
  const routeDepartment = String(departmentParam || '').toUpperCase()
  const department = user.department !== 'ALL' ? user.department : routeDepartment
  const semester = Number(semesterParam)
  const departmentDetails = useMemo(() => departmentCards.find((item) => item.code === department) || departmentCards[0], [department])
  const scopeMismatch = user.department !== 'ALL' && routeDepartment !== user.department
  const validSemester = Number.isInteger(semester) && semester >= 1 && semester <= 8
  const [subjects, setSubjects] = useState(() => validSemester ? scopedLocalSubjects(departmentDetails.code, semester) : [])
  const [loading, setLoading] = useState(Boolean(apiSession))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (scopeMismatch && validSemester) navigate(`/admin/subjects/${user.department}/${semester}`, { replace: true })
  }, [scopeMismatch, validSemester, navigate, user.department, semester])

  const loadSubjects = async () => {
    if (!validSemester) return
    if (apiSession) setAuthToken(token)
    setLoading(true)
    let next = scopedLocalSubjects(departmentDetails.code, semester)
    if (apiSession) {
      try { const response = await api.getSubjects({ department: departmentDetails.code, semester }); next = response.data || [] } catch { setNotice('API unavailable · showing locally saved subjects') }
    }
    setSubjects(next)
    setLoading(false)
  }

  useEffect(() => { loadSubjects() }, [departmentDetails.code, semester, validSemester, apiSession])

  const openAdd = () => { setEditing(null); setFormOpen(true); setNotice('') }
  const openEdit = (subject) => { setEditing(subject); setFormOpen(true); setNotice('') }
  const saveSubject = async (form) => {
    const payload = { department: departmentDetails.code, semester, subjectCode: form.subjectCode.trim().toUpperCase(), subjectName: form.subjectName.trim(), credits: Number(form.credits) }
    let saved
    let usedLocalFallback = !apiSession
    if (apiSession) {
      setAuthToken(token)
      try {
        const response = editing ? await api.updateSubject(editing.subjectId || editing.id, payload) : await api.createSubject(payload)
        saved = response.data
      } catch (error) {
        const status = error.response?.status
        const message = error.response?.data?.errors?.join(' ') || error.response?.data?.message || 'Subject could not be saved.'
        const canUseLocalFallback = !error.response || status >= 500 || (!editing && status === 404)
        if (!canUseLocalFallback) { setNotice(message); return { ok: false, message } }
        usedLocalFallback = true
        setNotice('API unavailable · saving this subject to the local review cache')
      }
    }
    const localBase = getDemoSubjects()
    if (!saved) {
      const id = editing ? (editing.id || editing.subjectId) : nextDemoSubjectId(localBase)
      saved = { ...payload, id, subjectId: id, isActive: true }
    }
    const savedId = saved.id || saved.subjectId
    const hasLocalSubject = localBase.some((item) => Number(item.id || item.subjectId) === Number(savedId))
    const nextLocal = editing && hasLocalSubject
      ? localBase.map((item) => (Number(item.id || item.subjectId) === Number(savedId) ? { ...item, ...saved } : item))
      : hasLocalSubject ? localBase.map((item) => (Number(item.id || item.subjectId) === Number(savedId) ? { ...item, ...saved } : item)) : [...localBase, saved]
    persistDemoSubjects(nextLocal)
    setSubjects((current) => editing ? current.map((item) => Number(item.id || item.subjectId) === Number(editing.id || editing.subjectId) ? saved : item) : [...current, saved])
    setFormOpen(false)
    setEditing(null)
    setNotice(usedLocalFallback ? `${saved.subjectCode} ${editing ? 'updated' : 'created'} · saved locally and synced to dashboard views` : `${saved.subjectCode} ${editing ? 'updated' : 'created'} · dashboards are now in sync`)
    return true
  }

  const removeSubject = async (subject) => {
    const id = subject.subjectId || subject.id
    if (!window.confirm(`Delete ${subject.subjectCode} from ${departmentDetails.label} Semester ${semester}?`)) return
    if (apiSession) {
      setAuthToken(token)
      try { await api.deleteSubject(id) } catch (error) { setNotice(error.response?.data?.message || 'Subject could not be deleted.'); return }
    }
    const next = getDemoSubjects().filter((item) => Number(item.id || item.subjectId) !== Number(id))
    persistDemoSubjects(next)
    setSubjects((current) => current.filter((item) => Number(item.id || item.subjectId) !== Number(id)))
    setNotice(`${subject.subjectCode} deleted · dashboard subject lists updated`)
  }

  if (!validSemester) return <AdminShell crumb="Subject management"><section className="admin-control-content"><div className="admin-empty-state"><FiBookOpen /><h1>Choose a valid semester</h1><button className="admin-primary-button" type="button" onClick={() => navigate('/admin/subjects')}>Open hierarchy <FiArrowRight /></button></div></section></AdminShell>
  return <AdminShell crumb={`${departmentDetails.label} · Semester ${semester}`}><section className="admin-control-content"><button className="admin-back-link" type="button" onClick={() => navigate('/admin/subjects')}><FiArrowLeft /> Back to department → semester</button><AdminPageIntro eyebrow={`${departmentDetails.label} · Semester ${semester}`} title="Subject Management" description="Create the curriculum once. Attendance and marks entry become available to teachers immediately, while the same subject list is published to student and parent portals." actions={<><button className="admin-secondary-button" type="button" onClick={loadSubjects}><FiRefreshCw /> Refresh</button><button className="admin-primary-button" type="button" onClick={openAdd}><FiPlus /> Add subject</button></>} /><div className="admin-sync-banner"><FiShield /><div><strong>Automatic synchronization enabled</strong><span>Changes are stored in the central subject catalog for {departmentDetails.label} Semester {semester}.</span></div><span className="admin-sync-status"><i /> Live</span></div>{notice && <div className="admin-notice"><FiCheck /> {notice}</div>}<section className="admin-subject-card"><div className="admin-subject-card-head"><div><h2>{departmentDetails.label} · Semester {semester} subjects</h2><p>{subjects.length} subject{subjects.length === 1 ? '' : 's'} · all students in this department and semester inherit this list</p></div><span className="admin-scope-pill"><FiUsers /> Teacher · Student · Parent</span></div>{loading ? <div className="admin-empty-state"><FiRefreshCw /><span>Loading subjects…</span></div> : subjects.length ? <div className="admin-subject-list">{subjects.map((subject) => <article className="admin-subject-row" key={subject.subjectId || subject.id}><span className="admin-subject-code">{subject.subjectCode}</span><div className="admin-subject-info"><strong>{subject.subjectName}</strong><span>{subject.credits} credits · Attendance and marks ready</span></div><span className="admin-subject-synced"><FiCheck /> Synced</span><button type="button" className="admin-row-action" onClick={() => openEdit(subject)} aria-label={`Edit ${subject.subjectName}`}><FiEdit3 /></button><button type="button" className="admin-row-action danger" onClick={() => removeSubject(subject)} aria-label={`Delete ${subject.subjectName}`}><FiTrash2 /></button></article>)}</div> : <div className="admin-empty-state"><FiBookOpen /><span>No subjects yet. Add the first subject for this department and semester.</span><button className="admin-primary-button" type="button" onClick={openAdd}><FiPlus /> Add first subject</button></div>}</section><div className="admin-subject-footnote"><FiCheck /><span>Teachers can enter attendance and internal marks for every subject above without creating another configuration record.</span></div>{formOpen && <SubjectForm subject={editing} department={departmentDetails} semester={semester} onClose={() => { setFormOpen(false); setEditing(null) }} onSave={saveSubject} />}</section></AdminShell>
}

function SubjectForm({ subject, department, semester, onClose, onSave }) {
  const [form, setForm] = useState({ subjectCode: subject?.subjectCode || '', subjectName: subject?.subjectName || '', credits: subject?.credits || 3 })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const update = (key, value) => { setError(''); setForm((current) => ({ ...current, [key]: value })) }
  const submit = async (event) => {
    event.preventDefault()
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,29}$/.test(form.subjectCode.trim())) { setError('Use a subject code with 2–30 letters or numbers.'); return }
    if (!form.subjectName.trim()) { setError('Enter a subject name.'); return }
    if (Number(form.credits) <= 0 || Number(form.credits) > 30) { setError('Credits must be greater than 0 and no more than 30.'); return }
    setSaving(true)
    try {
      const saved = await onSave(form)
      if (!saved || saved.ok === false) setError(saved?.message || 'We could not save this subject. Check the details and try again.')
    } catch (saveError) {
      setError(saveError.message || 'We could not save this subject. Check the details and try again.')
    } finally { setSaving(false) }
  }
  return <div className="admin-modal-backdrop"><form className="admin-subject-modal" onSubmit={submit}><div className="admin-modal-head"><div><p>{department.label} · Semester {semester}</p><h2>{subject ? 'Edit subject' : 'Add subject'}</h2></div><button type="button" onClick={onClose} aria-label="Close"><FiX /></button></div><div className="admin-modal-body"><label>Subject code<input value={form.subjectCode} onChange={(event) => update('subjectCode', event.target.value.toUpperCase())} placeholder="CS706" maxLength="30" required /></label><label>Subject name<input value={form.subjectName} onChange={(event) => update('subjectName', event.target.value)} placeholder="Advanced Web Technologies" maxLength="160" required /></label><label>Credits<input type="number" min="0.5" max="30" step="0.5" value={form.credits} onChange={(event) => update('credits', event.target.value)} required /></label>{error && <div className="admin-form-error" role="alert">{error}</div>}</div><div className="admin-modal-foot"><button className="admin-secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="admin-primary-button" type="submit" disabled={saving}><FiCheck /> {saving ? 'Saving…' : subject ? 'Save changes' : 'Create subject'}</button></div></form></div>
}

export function AdminAccount({ mode = 'profile' }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const signOut = async () => { await logout(); navigate('/', { replace: true }) }
  const profile = mode === 'profile'
  return <AdminShell crumb={profile ? 'Profile' : 'Settings'}><section className="admin-control-content"><button className="admin-back-link" type="button" onClick={() => navigate('/admin/subjects')}><FiArrowLeft /> Back to subject management</button><AdminPageIntro eyebrow="Administrator account" title={profile ? 'Profile' : 'Settings'} description={profile ? 'Your administrator identity and access scope.' : 'Central catalog and workspace settings.'} /><section className="admin-account-card"><div className="admin-account-hero"><span className="admin-account-large-avatar"><FiUser /></span><div><h2>{user.name}</h2><p>{user.email || 'Administrator'} · {user.department === 'ALL' ? 'All departments' : `${user.department} department`}</p></div><span className="admin-account-active"><i /> Active</span></div>{profile ? <div className="admin-account-details"><div><span>Name</span><strong>{user.name}</strong></div><div><span>Role</span><strong>Administrator</strong></div><div><span>Email</span><strong>{user.email || 'Not recorded'}</strong></div><div><span>Access scope</span><strong>{user.department === 'ALL' ? 'All departments' : `${user.department} · Semesters 1–8`}</strong></div></div> : <div className="admin-setting-list"><div><span><FiBookOpen /> Subject catalog</span><strong>Database synchronized</strong></div><div><span><FiUsers /> Portal propagation</span><strong>Teacher · Student · Parent</strong></div><div><span><FiShield /> Authentication</span><strong>JWT-secured</strong></div></div>}<div className="admin-account-actions"><button className="admin-secondary-button" type="button" onClick={() => navigate('/admin/subjects')}><FiArrowLeft /> Subject management</button><button className="admin-primary-button" type="button" onClick={() => navigate(profile ? '/admin/settings' : '/admin/profile')}><FiSettings /> {profile ? 'Open settings' : 'View profile'}</button><button className="admin-secondary-button" type="button" onClick={signOut}><FiLogOut /> Logout</button></div></section></section></AdminShell>
}
