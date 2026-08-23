import { Link, useParams } from "react-router-dom";
import {
  AttendanceBar, Card, DataTable, PageHeader, RiskBadge, Spinner,
} from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function ClassStudents() {
  const { id } = useParams();
  const { data, loading } = useFetch(`/teacher/classes/${id}/students`);

  if (loading) return <Spinner label="Loading students..." />;
  const { class: cls, students } = data;

  const columns = [
    { key: "usn", label: "USN", className: "font-mono text-xs font-semibold text-slate-600" },
    { key: "name", label: "Name", className: "font-medium text-slate-800" },
    {
      key: "attendance_percentage", label: "Attendance",
      render: (r) => (r.attendance_percentage != null ? <AttendanceBar value={r.attendance_percentage} /> : <span className="text-xs text-slate-400">Not uploaded</span>),
    },
    { key: "ia1", label: "IA1", render: (r) => r.ia1 ?? <span className="text-slate-300">—</span> },
    { key: "ia2", label: "IA2", render: (r) => r.ia2 ?? <span className="text-slate-300">—</span> },
    { key: "assignment_marks", label: "Assignment", render: (r) => r.assignment_marks ?? <span className="text-slate-300">—</span> },
    { key: "risk_level", label: "ML Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
    { key: "pass_probability", label: "Pass %", render: (r) => (r.pass_probability != null ? `${r.pass_probability}%` : "—") },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${cls.subject_code} · ${cls.subject_name}`}
        subtitle={`Semester ${cls.semester} · Section ${cls.section} · ${students.length} students`}
        actions={
          <Link to="/teacher" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            ← Back to classes
          </Link>
        }
      />
      <Card>
        <DataTable columns={columns} rows={students} rowKey="usn" />
      </Card>
    </div>
  );
}
