import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiCheck, FiEye, FiEyeOff, FiKey, FiLock, FiUser, FiUsers } from 'react-icons/fi'
import { Brand } from './Landing'
import { departmentCards } from '../data/departments'
import { useAuth } from '../context/AuthContext'

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

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login } = useAuth()
  const initialRole = accountDetails[params.get('role')] ? params.get('role') : 'teacher'
  const department = params.get('department') || 'CSE'
  const departmentDetails = useMemo(() => departmentCards.find((item) => item.code === department) || departmentCards[0], [department])
  const [role, setRole] = useState(initialRole)
  const [identifier, setIdentifier] = useState(accountDetails[initialRole].value)
  const [password, setPassword] = useState(accountDetails[initialRole].password)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const details = useMemo(() => accountDetails[role], [role])

  const changeRole = (nextRole) => {
    setRole(nextRole)
    setIdentifier(accountDetails[nextRole].value)
    setPassword(accountDetails[nextRole].password)
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ role, identifier, password, department })
      navigate(role === 'teacher' ? '/teacher/semesters' : role === 'admin' ? '/admin/subjects' : '/app', { replace: true })
    } catch (loginError) {
      setError(loginError.response?.data?.message || loginError.message || 'We could not sign you in. Please check your details.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="erp-login-page">
    <header className="erp-login-header"><Brand /><button className="erp-back-button" type="button" onClick={() => navigate('/')}><FiArrowLeft /> Change department</button></header>
    <section className="erp-login-shell" aria-labelledby="login-heading">
      <div className="erp-login-step"><span className="erp-step-label">Step 3</span><p>{departmentDetails.label} <span aria-hidden="true">→</span> {details.title}</p></div>
      <div className="erp-login-card">
        <div className="erp-login-card-heading"><span className={`erp-login-icon ${departmentDetails.tone}`}>{departmentDetails.icon}</span><div><span className="erp-login-department">{departmentDetails.label} · {departmentDetails.name}</span><h1 id="login-heading">{details.portal}</h1><p>{details.title} for the CAMPS academic workspace.</p></div></div>
        <div className="erp-login-role-tabs" aria-label="Choose login role">{roleOptions.map(({ label, value, icon: Icon }) => <button key={value} type="button" className={role === value ? 'active' : ''} onClick={() => changeRole(value)}><Icon /><span>{label}</span></button>)}</div>
        <form className="erp-login-form" onSubmit={submit}>
          <div className="erp-login-field"><label htmlFor="identifier">{details.label}<span>Required</span></label><div className="erp-login-input"><FiUser /><input id="identifier" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={details.placeholder} required /></div></div>
          <div className="erp-login-field"><label htmlFor="password">{details.passwordLabel || 'Password'}<span>Required</span></label><div className="erp-login-input"><FiLock /><input id="password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button className="erp-password-toggle" type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></div></div>
          {error && <div className="erp-login-error">{error}</div>}
          <button className="erp-login-submit" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign In Securely'} {!loading && <FiArrowRight />}</button>
        </form>
        <div className="erp-demo-hint"><span><FiKey /> Demo access enabled</span><button type="button" onClick={() => { setIdentifier(details.value); setPassword(details.password); setError('') }}>Use sample account</button></div>
        <p className="erp-login-security"><FiCheck /> JWT-secured, department-aware access</p>
      </div>
    </section>
  </main>
}
