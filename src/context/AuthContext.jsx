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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('camps_session')) || null
      // Keep the API interceptor in sync before protected child effects run.
      setAuthToken(stored?.token || '')
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

  const login = async ({ role, identifier, password, department }) => {
    const normalizedRole = role.toLowerCase()
    const requestedDepartment = String(department || '').trim().toUpperCase()
    if (!DEMO_MODE) {
      try {
        const result = await api.login({ role: normalizedRole, identifier, password, department: requestedDepartment })
        if (!isApiToken(result?.token) || !result?.user) throw new Error('The authentication service returned an incomplete session.')
        const user = { ...result.user, role: normalizedRole, department: normalizedRole === 'admin' ? requestedDepartment || result.user.department : result.user.department }
        const next = { token: result.token, user }
        persistSession(next)
        setAuthToken(next.token)
        setSession(next)
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
    return user
  }

  const logout = async () => {
    if (!DEMO_MODE && isApiToken(session?.token)) {
      try { await api.logout() } catch (error) { console.warn('[camps-auth] API logout failed; clearing local session anyway.', error.message) }
    }
    persistSession(null)
    setAuthToken('')
    setSession(null)
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
