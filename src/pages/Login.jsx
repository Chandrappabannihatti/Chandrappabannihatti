import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { FiArrowRight, FiCheck, FiEye, FiEyeOff, FiKey, FiLock, FiUser, FiUsers } from 'react-icons/fi'
import { Brand } from './Landing'
import BackButton from '../components/BackButton'
import { departmentCards, decorateDepartmentRows } from '../data/departments'
import { demoStudentForDepartment, demoTeacherForDepartment, parentUser, studentUser } from '../data/demo'
import { useAuth } from '../context/AuthContext'
import api, { DEMO_MODE } from '../lib/api'
import { dashboardPathForRole } from '../lib/roleRoutes'

const accountDetails = {
  admin: { title: 'Admin Login', portal: 'Admin Portal', label: 'Email Address', placeholder: 'admin@camps.edu', value: 'admin@camps.edu', password: 'Admin@123' },
  teacher: { title: 'Teacher Login', portal: 'Teacher Portal', label: 'Email Address', placeholder: 'name@pestrust.edu.in', value: 'teacher@camps.edu', password: 'Teacher@123' },
  student: { title: 'Student Login', portal: 'Student Portal', label: 'USN', placeholder: '4PM21CS001', value: '4PM21CS033', password: 'Student@123' },
  parent: { title: 'Parent Login', portal: 'Parent Portal', label: 'Student USN', passwordLabel: 'Parent Password', placeholder: '4PM21CS001', value: '4PM21CS033', password: 'Parent@123' },
}

const roleOptions = [
  { value: 'teacher', label: 'Teacher', icon: FiUser },
  { value: 'student', label: 'Student', icon: FiUsers },
  { value: 'parent', label: 'Parent', icon: FiUsers },
  { value: 'admin', label: 'Admin', icon: FiLock },
]

function sampleCredentials(role, department) {
  const code = String(department || '').trim().toUpperCase()
  if (role === 'admin') return { identifier: 'admin@camps.edu', password: 'Admin@123', available: true }
  if (role === 'teacher') {
    const teacher = demoTeacherForDepartment(code)
    return teacher ? { identifier: teacher.email, password: teacher.password || 'Teacher@123', available: true } : { identifier: '', password: '', available: false }
  }
  const student = code === 'CSE' ? studentUser : demoStudentForDepartment(code)
  if (!student) return { identifier: '', password: '', available: false }
  if (role === 'student') return { identifier: student.usn, password: 'Student@123', available: true }
  if (role === 'parent') return { identifier: code === 'CSE' ? parentUser.usn : student.usn, password: 'Parent@123', available: true }
  return { identifier: '', password: '', available: false }
}

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login, isAuthenticated, user } = useAuth()
  const initialRole = accountDetails[params.get('role')] ? params.get('role') : 'teacher'
  const department = String(params.get('department') || '').trim().toUpperCase()
  const [departments, setDepartments] = useState(departmentCards)
  const [departmentsLoading, setDepartmentsLoading] = useState(!DEMO_MODE)
  const departmentDetails = useMemo(() => departments.find((item) => item.code === department) || { code: department, label: department, name: department, tagline: 'Department-scoped CAMPS access.', icon: '◎', tone: 'slate' }, [departments, department])
  const initialSample = sampleCredentials(initialRole, department)
  const [role, setRole] = useState(initialRole)
  const [identifier, setIdentifier] = useState(initialSample.identifier)
  const [password, setPassword] = useState(initialSample.password)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(params.get('reason') === 'session' ? 'Your session expired. Please sign in again to continue.' : '')
  const details = useMemo(() => accountDetails[role], [role])
  const sample = useMemo(() => sampleCredentials(role, departmentDetails.code), [role, departmentDetails.code])

  useEffect(() => {
    if (DEMO_MODE) return undefined
    let mounted = true
    api.getLoginDepartments().then((response) => {
      const configured = decorateDepartmentRows(response?.data)
      if (mounted && configured.length) setDepartments(configured)
    }).catch((loadError) => {
      console.warn('[camps-auth] Login department catalog could not be refreshed.', { status: loadError.response?.status || 'network', message: loadError.response?.data?.message || loadError.message })
    }).finally(() => { if (mounted) setDepartmentsLoading(false) })
    return () => { mounted = false }
  }, [])

  if (isAuthenticated && user) return <Navigate to={dashboardPathForRole(user.role)} replace />
  if (!departmentsLoading && !departments.some((item) => item.code === department)) return <Navigate to="/" replace />

  const changeRole = (nextRole) => {
    const nextSample = sampleCredentials(nextRole, departmentDetails.code)
    setRole(nextRole)
    setIdentifier(nextSample.identifier)
    setPassword(nextSample.password)
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const authenticatedUser = await login({ role, identifier, password, department: departmentDetails.code })
      if (!authenticatedUser?.role) throw new Error('The authentication service returned no user role.')
      navigate(dashboardPathForRole(authenticatedUser.role), { replace: true })
    } catch (loginError) {
      setError(loginError.response?.data?.message || loginError.message || 'We could not sign you in. Please check your details.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="erp-login-page">
    <header className="erp-login-header"><Brand /><BackButton fallbackPath="/" label="Back" minHistoryIndex={1} /></header>
    <section className="erp-login-shell" aria-labelledby="login-heading">
      <div className="erp-login-step"><span className="erp-step-label">Step 2</span><p>{departmentDetails.label} <span aria-hidden="true">→</span> Choose role and sign in</p></div>
      <div className="erp-login-card">
        <div className="erp-login-card-heading"><span className={`erp-login-icon ${departmentDetails.tone}`}>{departmentDetails.icon}</span><div><span className="erp-login-department">{departmentDetails.label} · {departmentDetails.name}</span><h1 id="login-heading">{details.portal}</h1><p>{details.title} for the CAMPS academic workspace.</p></div></div>
        <div className="erp-login-role-tabs" aria-label="Choose login role">{roleOptions.map(({ label, value, icon: Icon }) => <button key={value} type="button" className={role === value ? 'active' : ''} onClick={() => changeRole(value)}><Icon /><span>{label}</span></button>)}</div>
        <form className="erp-login-form" onSubmit={submit}>
          <div className="erp-login-field"><label htmlFor="identifier">{details.label}<span>Required</span></label><div className="erp-login-input"><FiUser /><input id="identifier" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={details.placeholder} required /></div></div>
          <div className="erp-login-field"><label htmlFor="password">{details.passwordLabel || 'Password'}<span>Required</span></label><div className="erp-login-input"><FiLock /><input id="password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button className="erp-password-toggle" type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></div></div>
          {error && <div className="erp-login-error">{error}</div>}
          <button className="erp-login-submit" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign In Securely'} {!loading && <FiArrowRight />}</button>
        </form>
        <div className="erp-demo-hint"><span><FiKey /> {sample.available ? 'Department sample account available' : 'Use your assigned CAMPS credentials'}</span>{sample.available && <button type="button" onClick={() => { setIdentifier(sample.identifier); setPassword(sample.password); setError('') }}>Use sample account</button>}</div>
        <p className="erp-login-security"><FiCheck /> JWT-secured, department-aware access</p>
      </div>
    </section>
  </main>
}
