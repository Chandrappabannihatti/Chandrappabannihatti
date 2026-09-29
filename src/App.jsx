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
import AdminSubjectHierarchy, { AdminAccount } from './pages/AdminSubjects'

function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuth()
  const currentPath = window.location.pathname
  useEffect(() => {
    if (isAuthenticated && user) console.info('[route-access] Protected route evaluated.', { path: currentPath, role: user.role, userId: user.id, requiredRole: role || 'learner-or-admin' })
  }, [currentPath, isAuthenticated, role, user])
  if (!isAuthenticated) {
    console.warn('[route-access] Protected route requires authentication.', { path: currentPath, requiredRole: role || 'learner-or-admin' })
    return <Navigate to="/" replace />
  }
  if (role && user.role !== role) {
    const fallback = user.role === 'teacher' ? '/teacher/departments' : user.role === 'admin' ? '/admin/subjects' : '/app'
    console.warn('[route-access] Role mismatch; redirecting to the authenticated workspace.', { path: currentPath, requiredRole: role, actualRole: user.role, redirect: fallback, userId: user.id })
    return <Navigate to={fallback} replace />
  }
  if (!role && user.role === 'teacher') {
    console.info('[route-access] Teacher sent to the teacher workspace.', { path: currentPath, userId: user.id })
    return <Navigate to="/teacher/departments" replace />
  }
  if (!role && !['admin', 'student', 'parent'].includes(user.role)) {
    console.warn('[route-access] Unknown role blocked from learner workspace.', { path: currentPath, actualRole: user.role, userId: user.id })
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/subjects" element={<ProtectedRoute role="admin"><AdminSubjectHierarchy /></ProtectedRoute>} />
      <Route path="/admin/subjects/:department/:semester" element={<ProtectedRoute role="admin"><Navigate to="/admin/subjects" replace /></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute role="admin"><AdminAccount mode="profile" /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminAccount mode="settings" /></ProtectedRoute>} />
      <Route path="/teacher/departments" element={<ProtectedRoute role="teacher"><DepartmentSelection /></ProtectedRoute>} />
      <Route path="/teacher/department/:department/*" element={<ProtectedRoute role="teacher"><TeacherDepartment /></ProtectedRoute>} />
      <Route path="/teacher/semesters" element={<ProtectedRoute role="teacher"><SemesterSelection /></ProtectedRoute>} />
      <Route path="/teacher/profile" element={<ProtectedRoute role="teacher"><TeacherAccount mode="profile" /></ProtectedRoute>} />
      <Route path="/teacher/settings" element={<ProtectedRoute role="teacher"><TeacherAccount mode="settings" /></ProtectedRoute>} />
      <Route path="/teacher/student/:usn" element={<ProtectedRoute role="teacher"><TeacherStudentProfile /></ProtectedRoute>} />
      <Route path="/teacher/semester/:semester/*" element={<ProtectedRoute role="teacher"><TeacherSemester /></ProtectedRoute>} />
      <Route path="/app/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
