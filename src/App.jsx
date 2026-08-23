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

function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher/departments' : '/app'} replace />
  if (!role && user.role === 'teacher') return <Navigate to="/teacher/departments" replace />
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
      <Route path="/app/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
