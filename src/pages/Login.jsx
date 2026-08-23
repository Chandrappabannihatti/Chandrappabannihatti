import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiEye, FiEyeOff, FiKey, FiLock, FiMail, FiUser } from 'react-icons/fi'
import { Brand } from './Landing'
import { useAuth } from '../context/AuthContext'

const accountDetails = {
  admin: { title: 'Admin login', label: 'Email address', placeholder: 'admin@camps.edu', value: 'admin@camps.edu', password: 'Admin@123', hint: 'admin@camps.edu · Admin@123' },
  teacher: { title: 'Teacher login', label: 'Email address', placeholder: 'name@pestrust.edu.in', value: 'teacher@camps.edu', password: 'Teacher@123', hint: 'teacher@camps.edu · Teacher@123' },
  student: { title: 'Student login', label: 'University seat number', placeholder: '4PM21CS033', value: '4PM21CS033', password: 'Student@123', hint: '4PM21CS033 · Student@123' },
  parent: { title: 'Parent login', label: 'Student USN', placeholder: '4PM21CS033', value: '4PM21CS033', password: 'Parent@123', hint: '4PM21CS033 · Parent@123' },
}

const roleOptions = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'admin', label: 'Admin' },
]

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login } = useAuth()
  const initialRole = accountDetails[params.get('role')] ? params.get('role') : 'teacher'
  const [role, setRole] = useState(initialRole)
  const [department] = useState(params.get('department') || 'CSE')
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
      navigate(role === 'teacher' ? '/teacher/departments' : '/app', { replace: true })
    } catch (loginError) {
      setError(loginError.message || 'We could not sign you in. Please check your details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <aside className="login-aside">
        <Brand light />
        <div className="aside-content">
          <p className="eyebrow">Your academic workspace</p>
          <h1 className="aside-title">Progress is a <em>conversation.</em></h1>
          <p className="aside-description">A shared view for teachers, learners and families—designed to turn small signals into timely action.</p>
        </div>
        <div className="login-proof"><span className="proof-dots"><span>AR</span><span>IK</span><span>SK</span></span><span>Trusted by the PES academic community</span></div>
      </aside>
      <section className="login-panel">
        <div className="login-card">
          <button className="back-link" type="button" onClick={() => navigate('/')}><FiArrowLeft /> Back to CAMPS home</button>
          <p className="eyebrow">Secure portal access</p>
          <h2 className="login-heading">{details.title}</h2>
          <p className="login-subheading">Sign in to continue to your academic workspace.</p>
          {role !== 'admin' && <span className="login-context"><FiCheckCircle /> {department} department · scoped access</span>}
          <div className="role-switcher" aria-label="Choose login role">
            {roleOptions.map((option) => <button key={option.value} className={role === option.value ? 'active' : ''} type="button" onClick={() => changeRole(option.value)}>{option.label}</button>)}
          </div>
          <form className="login-form" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="identifier">{details.label}<span>{role === 'student' || role === 'parent' ? 'USN' : 'Required'}</span></label>
              <div className="input-wrap"><FiUser /><input id="identifier" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={details.placeholder} required /></div>
            </div>
            <div className="form-field">
              <label htmlFor="password">Password<span>Required</span></label>
              <div className="input-wrap"><FiLock /><input id="password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button className="password-toggle" type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></div>
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="login-submit" disabled={loading} type="submit">{loading ? 'Signing you in…' : 'Enter academic workspace'} {!loading && <FiArrowRight />}</button>
          </form>
          <div className="demo-hint"><span><FiKey style={{ verticalAlign: 'middle', marginRight: 5 }} /> Demo access enabled for review</span><button type="button" onClick={() => { setIdentifier(details.value); setPassword(details.password); setError('') }}>Use sample account</button></div>
          <p className="login-foot">Your data is protected with JWT-secured access and department-level permissions.</p>
        </div>
      </section>
    </main>
  )
}
