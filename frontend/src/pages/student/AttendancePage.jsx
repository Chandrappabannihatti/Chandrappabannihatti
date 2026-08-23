import { SubjectAttendanceBar } from "../../components/charts";
import {
  AttendanceBar, Badge, Card, DataTable, PageHeader, Spinner, StatCard,
} from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function AttendancePage() {
  const { data, loading } = useFetch("/student/attendance");
  if (loading) return <Spinner label="Loading attendance..." />;

  const eligible = (data?.overall ?? 0) >= 75;

  const columns = [
    { key: "subject_code", label: "Code", className: "font-mono text-xs font-bold text-indigo-600" },
    { key: "subject_name", label: "Subject", className: "font-medium text-slate-800" },
    { key: "classes_held", label: "Held" },
    { key: "classes_attended", label: "Attended" },
    { key: "percentage", label: "Percentage", render: (r) => <AttendanceBar value={r.percentage} /> },
    {
      key: "status", label: "Status",
      render: (r) =>
        r.percentage >= 85 ? <Badge tone="emerald">Excellent</Badge>
        : r.percentage >= 75 ? <Badge tone="indigo">Eligible</Badge>
        : <Badge tone="rose">Shortage</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Attendance" subtitle="Subject-wise breakdown for the current semester" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Overall Attendance" value={data?.overall} suffix="%" icon="attendance" tone={eligible ? "emerald" : "rose"} />
        <StatCard label="Exam Eligibility" value={eligible ? "Eligible" : "Shortage"} icon={eligible ? "attendance" : "risk"} tone={eligible ? "emerald" : "rose"} hint="75% required" />
        <StatCard label="Subjects Tracked" value={data?.subjects?.length || 0} icon="book" tone="indigo" />
      </div>
      <Card title="Attendance Chart">
        <SubjectAttendanceBar data={data?.subjects} />
      </Card>
      <Card title="Detailed Records">
        <DataTable columns={columns} rows={data?.subjects || []} rowKey="subject_code" />
      </Card>
    </div>
  );
}
