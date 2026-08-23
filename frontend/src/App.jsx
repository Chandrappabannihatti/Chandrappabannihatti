import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Academics from "./pages/admin/Academics";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageParents from "./pages/admin/ManageParents";
import ManageStudents from "./pages/admin/ManageStudents";
import ManageTeachers from "./pages/admin/ManageTeachers";
import MLAnalytics from "./pages/admin/MLAnalytics";
import Reports from "./pages/admin/Reports";
import ParentDashboard from "./pages/parent/ParentDashboard";
import AttendancePage from "./pages/student/AttendancePage";
import PredictionPage from "./pages/student/PredictionPage";
import ResultsPage from "./pages/student/ResultsPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import AtRiskStudents from "./pages/teacher/AtRiskStudents";
import ClassStudents from "./pages/teacher/ClassStudents";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import UploadData from "./pages/teacher/UploadData";

function Protected({ roles, children }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <Navigate to={`/${role}`} replace />;
  return children;
}

function HomeRedirect() {
  const { isAuthenticated, role } = useAuth();
  return <Navigate to={isAuthenticated ? `/${role}` : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route element={<Protected roles={["admin"]}><Layout /></Protected>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<ManageStudents />} />
        <Route path="/admin/teachers" element={<ManageTeachers />} />
        <Route path="/admin/academics" element={<Academics />} />
        <Route path="/admin/parents" element={<ManageParents />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/ml-analytics" element={<MLAnalytics />} />
      </Route>

      <Route element={<Protected roles={["teacher"]}><Layout /></Protected>}>
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/classes/:id" element={<ClassStudents />} />
        <Route path="/teacher/upload" element={<UploadData />} />
        <Route path="/teacher/at-risk" element={<AtRiskStudents />} />
      </Route>

      <Route element={<Protected roles={["student"]}><Layout /></Protected>}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/attendance" element={<AttendancePage />} />
        <Route path="/student/results" element={<ResultsPage />} />
        <Route path="/student/prediction" element={<PredictionPage />} />
      </Route>

      <Route element={<Protected roles={["parent"]}><Layout /></Protected>}>
        <Route path="/parent" element={<ParentDashboard />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
