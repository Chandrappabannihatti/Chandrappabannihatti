import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api, { DEMO_MODE } from '../lib/api'
import { currentUser, parentUser, studentUser } from '../data/demo'

const AuthContext = createContext(null)

const demoAccounts = {
  admin: { secret: 'admin@camps.edu', password: 'Admin@123', user: { name: 'Kavya Menon', role: 'admin', designation: 'Academic Administrator', email: 'admin@camps.edu', department: 'ALL', initials: 'KM' } },
  teacher: { secret: 'teacher@camps.edu', password: 'Teacher@123', user: currentUser },
  student: { secret: studentUser.usn, password: 'Student@123', user: studentUser },
  parent: { secret: parentUser.usn, password: 'Parent@123', user: parentUser },
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('camps_session')) || null } catch { return null }
  })

  useEffect(() => {
    if (session) localStorage.setItem('camps_session', JSON.stringify(session))
    else localStorage.removeItem('camps_session')
  }, [session])

  const login = async ({ role, identifier, password, department }) => {
    const normalizedRole = role.toLowerCase()
    if (!DEMO_MODE) {
      try {
        const result = await api.login({ role: normalizedRole, identifier, password, department })
        const next = { token: result.token, user: { ...result.user, role: normalizedRole } }
        setSession(next)
        return next.user
      } catch (apiError) {
        // Keep the review build usable when the optional API is not running.
        // Authentication errors from a reachable API are never silently bypassed.
        if (apiError.response?.status === 401 || apiError.response?.status === 403 || apiError.response?.status === 422) throw apiError
      }
    }

    const account = demoAccounts[normalizedRole]
    if (!account || identifier.trim().toLowerCase() !== account.secret.toLowerCase() || password !== account.password) {
      throw new Error(`Use the demo ${normalizedRole} credentials shown below to continue.`)
    }
    const requestedDepartment = String(department || '').trim().toUpperCase()
    if (normalizedRole !== 'admin' && requestedDepartment && requestedDepartment !== account.user.department) {
      throw new Error(`This demo ${normalizedRole} account is scoped to ${account.user.department}. Choose that department to continue.`)
    }
    const user = { ...account.user, department: normalizedRole === 'admin' ? 'ALL' : account.user.department }
    const next = { token: 'demo-session-token', user }
    setSession(next)
    return user
  }

  const logout = async () => {
    if (!DEMO_MODE && session?.token) {
      try { await api.logout() } catch { /* local session is still cleared */ }
    }
    setSession(null)
  }

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || null,
    isAuthenticated: Boolean(session?.user),
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
