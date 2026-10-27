import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SemesterSelection from './pages/SemesterSelection'
import DepartmentSelection, { TeacherDepartment } from './pages/DepartmentSelection'
import TeacherSemester, { TeacherStudentProfile } from './pages/TeacherSemester'
import TeacherAccount from './pages/TeacherAccount'
import AdminSubjectHierarchy, { AdminAccount, AdminSubjectManagement } from './pages/AdminSubjects'
import { canAccessDashboardRole, dashboardPathForRole } from './lib/roleRoutes'

function ProtectedRoute({ children, role, roles }) {
  const { isAuthenticated, user } = useAuth()
  const currentPath = window.location.pathname
  const allowedRoles = roles || (role ? [role] : ['admin', 'student', 'parent'])
  const requiredRoles = allowedRoles.join(',')
  useEffect(() => {
    if (isAuthenticated && user) console.info('[route-access] Protected route evaluated.', { path: currentPath, role: user.role, userId: user.id, requiredRole: role || requiredRoles })
  }, [currentPath, isAuthenticated, role, requiredRoles, user])
  if (!isAuthenticated) {
    console.warn('[route-access] Protected route requires authentication.', { path: currentPath, requiredRole: role || requiredRoles })
    return <Navigate to="/" replace />
  }
  if (!canAccessDashboardRole(user.role) || !allowedRoles.includes(user.role)) {
    const fallback = canAccessDashboardRole(user.role) ? dashboardPathForRole(user.role) : '/'
    console.warn('[route-access] Role mismatch; redirecting to the authenticated workspace.', { path: currentPath, requiredRole: role || allowedRoles.join(','), actualRole: user.role, redirect: fallback, userId: user.id })
    return <Navigate to={fallback} replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/subjects" element={<ProtectedRoute role="admin"><AdminSubjectHierarchy /></ProtectedRoute>} />
      <Route path="/admin/subjects/:department/:semester" element={<ProtectedRoute role="admin"><AdminSubjectManagement /></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute role="admin"><AdminAccount mode="profile" /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminAccount mode="settings" /></ProtectedRoute>} />
      <Route path="/teacher/departments" element={<ProtectedRoute role="teacher"><DepartmentSelection /></ProtectedRoute>} />
      <Route path="/teacher/department/:department/*" element={<ProtectedRoute role="teacher"><TeacherDepartment /></ProtectedRoute>} />
      <Route path="/teacher/semesters" element={<ProtectedRoute role="teacher"><SemesterSelection /></ProtectedRoute>} />
      <Route path="/teacher/profile" element={<ProtectedRoute role="teacher"><TeacherAccount mode="profile" /></ProtectedRoute>} />
      <Route path="/teacher/settings" element={<ProtectedRoute role="teacher"><TeacherAccount mode="settings" /></ProtectedRoute>} />
      <Route path="/teacher/student/:usn" element={<ProtectedRoute role="teacher"><TeacherStudentProfile /></ProtectedRoute>} />
      <Route path="/teacher/semester/:semester/*" element={<ProtectedRoute role="teacher"><TeacherSemester /></ProtectedRoute>} />
      <Route path="/app/*" element={<ProtectedRoute roles={['admin', 'student', 'parent']}><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
