import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api, { DEMO_MODE, LOCAL_SESSION_TOKEN, isApiToken, setAuthToken } from '../lib/api'
import { currentUser, parentUser, studentUser } from '../data/demo'

const AuthContext = createContext(null)

const demoAccounts = {
  admin: { secret: 'admin@camps.edu', password: 'Admin@123', user: { name: 'Kavya Menon', role: 'admin', designation: 'Academic Administrator', email: 'admin@camps.edu', department: 'ALL', initials: 'KM' } },
  teacher: { secret: 'teacher@camps.edu', password: 'Teacher@123', user: currentUser },
  student: { secret: studentUser.usn, password: 'Student@123', user: studentUser },
  parent: { secret: parentUser.usn, password: 'Parent@123', user: parentUser },
}

function persistSession(next) {
  try {
    if (next) localStorage.setItem('camps_session', JSON.stringify(next))
    else localStorage.removeItem('camps_session')
  } catch { /* keep in-memory auth when storage is unavailable */ }
}

function tokenExpired(token) {
  if (!isApiToken(token)) return false
  try {
    const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(window.atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')))
    return Number.isFinite(payload.exp) && payload.exp * 1000 <= Date.now()
  } catch {
    // The API remains the authority for signature validation. A malformed
    // token is left in place long enough for the protected request to produce
    // the normal session-expired path and its diagnostic log.
    return false
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('camps_session')) || null
      if (stored?.token && tokenExpired(stored.token)) {
        console.warn('[camps-auth] Stored session expired during restoration.', { role: stored.user?.role, userId: stored.user?.id })
        localStorage.removeItem('camps_session')
        setAuthToken('')
        return null
      }
      // Keep the API interceptor in sync before protected child effects run.
      setAuthToken(stored?.token || '')
      if (stored?.user) console.info('[camps-auth] Session restored from localStorage.', { role: stored.user.role, userId: stored.user.id, department: stored.user.department })
      return stored
    } catch {
      setAuthToken('')
      return null
    }
  })

  useEffect(() => {
    persistSession(session)
    setAuthToken(session?.token || '')
  }, [session])

  useEffect(() => {
    const syncStoredSession = (event) => {
      if (event.key && event.key !== 'camps_session') return
      try {
        const next = event.newValue ? JSON.parse(event.newValue) : null
        setAuthToken(next?.token || '')
        setSession(next)
      } catch (error) {
        console.warn('[camps-auth] Could not restore the session from storage.', error)
        setAuthToken('')
        setSession(null)
      }
    }
    window.addEventListener('storage', syncStoredSession)
    return () => window.removeEventListener('storage', syncStoredSession)
  }, [])

  useEffect(() => {
    if (!isApiToken(session?.token)) return undefined
    let mounted = true
    console.info('[camps-auth] Validating restored JWT session.', { role: session.user?.role, userId: session.user?.id })
    api.validateSession().then((result) => {
      if (!mounted || !result?.user) return
      setSession((current) => current ? { ...current, user: { ...current.user, ...result.user } } : current)
      console.info('[camps-auth] Restored JWT session is valid.', { role: result.user.role, userId: result.user.id, department: result.user.department, usn: result.user.usn, studentId: result.user.studentId })
    }).catch((error) => {
      console.error('[camps-auth] Restored JWT session validation failed.', { status: error.response?.status || 'network', message: error.response?.data?.message || error.message })
      if (mounted && error.response?.status === 401) {
        persistSession(null)
        setAuthToken('')
        setSession(null)
      }
    })
    return () => { mounted = false }
  }, [session?.token])

  const login = async ({ role, identifier, password, department }) => {
    const normalizedRole = role.toLowerCase()
    const requestedDepartment = String(department || '').trim().toUpperCase()
    console.info('[camps-auth] Login started.', { role: normalizedRole, identifier: String(identifier || '').trim(), department: requestedDepartment, apiMode: !DEMO_MODE })
    if (!DEMO_MODE) {
      try {
        const result = await api.login({ role: normalizedRole, identifier, password, department: requestedDepartment })
        if (!isApiToken(result?.token) || !result?.user) throw new Error('The authentication service returned an incomplete session.')
        const user = { ...result.user, role: normalizedRole, department: normalizedRole === 'admin' ? requestedDepartment || result.user.department : result.user.department }
        const next = { token: result.token, user }
        persistSession(next)
        setAuthToken(next.token)
        setSession(next)
        console.info('[camps-auth] API login succeeded.', { role: next.user.role, userId: next.user.id, department: next.user.department, usn: next.user.usn, studentId: next.user.studentId })
        return next.user
      } catch (apiError) {
        console.warn('[camps-auth] API login failed; evaluating local review fallback.', {
          role: normalizedRole,
          status: apiError.response?.status || 'network',
          message: apiError.response?.data?.message || apiError.message,
        })
        // Keep the review build usable when the optional API is not running.
        // Authentication errors from a reachable API are never silently bypassed.
        if (apiError.response?.status === 401 || apiError.response?.status === 403 || apiError.response?.status === 422) throw apiError
      }
    }

    let user
    let localTeacher = null
    if (normalizedRole === 'teacher') {
      try {
        const storedTeachers = JSON.parse(localStorage.getItem('camps_teachers') || '[]')
        localTeacher = Array.isArray(storedTeachers) ? storedTeachers.find((teacher) => teacher.email?.toLowerCase() === identifier.trim().toLowerCase() && teacher.password) : null
      } catch { /* fall through to the bundled demo account */ }
    }
    if (localTeacher) {
      if (password !== localTeacher.password) throw new Error('Invalid teacher credentials.')
      if (requestedDepartment && requestedDepartment !== localTeacher.department) throw new Error(`This demo teacher account is scoped to ${localTeacher.department}. Choose that department to continue.`)
      const { password: _password, ...teacherProfile } = localTeacher
      user = { ...teacherProfile, role: 'teacher', department: localTeacher.department }
    } else {
      const account = demoAccounts[normalizedRole]
      if (!account || identifier.trim().toLowerCase() !== account.secret.toLowerCase() || password !== account.password) {
        throw new Error(`Use the demo ${normalizedRole} credentials shown below to continue.`)
      }
      if (normalizedRole !== 'admin' && requestedDepartment && requestedDepartment !== account.user.department) {
        throw new Error(`This demo ${normalizedRole} account is scoped to ${account.user.department}. Choose that department to continue.`)
      }
      user = { ...account.user, department: normalizedRole === 'admin' ? requestedDepartment || account.user.department : account.user.department }
    }
    const next = { token: LOCAL_SESSION_TOKEN, user }
    persistSession(next)
    setAuthToken(next.token)
    setSession(next)
    console.info('[camps-auth] Local demo login succeeded.', { role: user.role, userId: user.id, department: user.department, usn: user.usn, studentId: user.studentId })
    return user
  }

  const logout = async () => {
    console.info('[camps-auth] Logout started.', { role: session?.user?.role, userId: session?.user?.id, hasApiToken: isApiToken(session?.token) })
    if (!DEMO_MODE && isApiToken(session?.token)) {
      try { await api.logout() } catch (error) { console.warn('[camps-auth] API logout failed; clearing local session anyway.', error.message) }
    }
    persistSession(null)
    setAuthToken('')
    setSession(null)
    console.info('[camps-auth] Local session cleared.')
  }

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || null,
    isAuthenticated: Boolean(session?.user && session?.token),
    isApiAuthenticated: Boolean(session?.user && isApiToken(session?.token)),
    login,
    logout,
  }), [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
