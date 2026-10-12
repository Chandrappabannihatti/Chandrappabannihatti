import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiArrowRight, FiBookOpen, FiCheckCircle, FiChevronRight, FiLogOut, FiRefreshCw, FiSettings, FiShield, FiUser } from 'react-icons/fi'
import { cloneDemoStudents, semesters } from '../data/demo'
import { useAuth } from '../context/AuthContext'
import api, { DEMO_MODE, getAuthToken, isApiToken } from '../lib/api'
import { Brand } from './Landing'
import BackButton from '../components/BackButton'

const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

function scopedStudents(students, department) {
  return students.filter((student) => student.department === department)
}

export default function SemesterSelection() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const apiSession = !DEMO_MODE && isApiToken(getAuthToken())
  const [students, setStudents] = useState(() => apiSession ? [] : scopedStudents(cloneDemoStudents(), user.department))
  const [loading, setLoading] = useState(apiSession)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    if (!apiSession) {
      setStudents(scopedStudents(cloneDemoStudents(), user.department))
      setLoading(false)
      setError('')
      return () => { mounted = false }
    }

    const loadStudents = async () => {
      setLoading(true)
      setError('')
      try {
        const firstPage = await api.getStudents({ department: user.department, page: 1, limit: 100 })
        const pages = Number(firstPage?.pagination?.pages || 1)
        const additionalPages = pages > 1
          ? await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.getStudents({ department: user.department, page: index + 2, limit: 100 })))
          : []
        const rows = [firstPage, ...additionalPages].flatMap((result) => Array.isArray(result?.data) ? result.data : [])
        if (mounted) setStudents(scopedStudents(rows, user.department))
      } catch (loadError) {
        if (!mounted) return
        console.error('[semester-selection] Student count request failed.', { status: loadError.response?.status || 'network', message: loadError.response?.data?.message || loadError.message, department: user.department })
        setStudents([])
        setError('Live student counts are temporarily unavailable. Retry to load the selected department records.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadStudents()
    return () => { mounted = false }
  }, [apiSession, reloadKey, user.department])

  const counts = useMemo(() => semesters.reduce((result, semester) => {
    result[semester] = students.filter((student) => Number(student.semester) === Number(semester)).length
    return result
  }, {}), [students])

  const signOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return <main className="semester-selection-page">
    <header className="selection-topbar"><Brand /><div className="selection-user"><span className="selection-user-avatar">{user.initials}</span><span><strong>{user.name}</strong><small>{user.department} · Teacher</small></span><div className="selection-account-links"><button type="button" onClick={() => navigate('/teacher/profile')}><FiUser /> Profile</button><button type="button" onClick={() => navigate('/teacher/settings')}><FiSettings /> Settings</button></div><button className="selection-logout" type="button" onClick={signOut} aria-label="Sign out"><FiLogOut /></button></div></header>
    <section className="selection-content semester-selection-content">
      <BackButton fallbackPath="/teacher/departments" />
      <div className="semester-selection-hero">
        <div><p className="page-eyebrow">Teacher workspace · Department scope</p><h1>Select Semester</h1><p>Choose a semester to view academic records.</p></div>
        <div className="semester-selection-department"><span><FiShield /> Selected department</span><strong>{user.department}</strong><small>Student records are limited to this department.</small></div>
      </div>
      <div className="semester-selection-summary"><div><strong>Academic records</strong><span>Eight semester views are available for {user.department}.</span></div><span className="semester-selection-status"><FiBookOpen /> {loading ? 'Loading counts' : 'Live student counts'}</span></div>
      {error && <div className="semester-selection-error" role="status"><FiAlertCircle /><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)}><FiRefreshCw /> Retry</button></div>}
      <div className="selection-list semester-selection-grid" aria-label="Semester list">{semesters.map((semester, index) => {
        const count = counts[semester] || 0
        const countText = loading ? 'Loading count' : error ? 'Counts unavailable' : count === 0 ? 'No students yet' : `${count} ${count === 1 ? 'student' : 'students'} · ${user.department}`
        return <button key={semester} className="selection-semester-row" type="button" onClick={() => navigate(`/teacher/semester/${semester}`)} aria-label={`Open ${ordinals[index]} Semester for ${user.department}`}>
          <span className="selection-semester-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="selection-semester-badge" aria-hidden="true"><FiBookOpen /></span>
          <span className="selection-semester-copy"><strong>{ordinals[index]} Semester</strong><small>Open academic dashboard</small></span>
          <span className="selection-semester-count"><strong>{loading ? '—' : count}</strong><small>{countText}</small></span>
          <FiChevronRight className="selection-chevron" aria-hidden="true" />
        </button>
      })}</div>
      <div className="selection-note"><FiCheckCircle /><span>Each semester opens its own section chooser before section-level students, attendance, marks, communication or XGBoost data is shown.</span><FiArrowRight aria-hidden="true" /></div>
    </section>
    <footer className="selection-footer"><span>PES Institute of Technology and Management · Shivamogga</span><span>CAMPS · Academic year 2026–27</span></footer>
  </main>
}
