import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SemesterSelection from './pages/SemesterSelection'
import TeacherSemester, { TeacherStudentProfile } from './pages/TeacherSemester'

function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher/semesters' : '/app'} replace />
  if (!role && user.role === 'teacher') return <Navigate to="/teacher/semesters" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/teacher/semesters" element={<ProtectedRoute role="teacher"><SemesterSelection /></ProtectedRoute>} />
      <Route path="/teacher/student/:usn" element={<ProtectedRoute role="teacher"><TeacherStudentProfile /></ProtectedRoute>} />
      <Route path="/teacher/semester/:semester/*" element={<ProtectedRoute role="teacher"><TeacherSemester /></ProtectedRoute>} />
      <Route path="/app/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
