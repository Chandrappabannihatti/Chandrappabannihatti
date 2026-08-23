import {
  Card, DataTable, PageHeader, RiskBadge, Spinner, StatCard,
} from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function AtRiskStudents() {
  const { data, loading } = useFetch("/teacher/at-risk");
  if (loading) return <Spinner label="Scanning predictions..." />;

  const students = data?.students || [];
  const high = students.filter((s) => s.risk_level === "High").length;

  const columns = [
    { key: "usn", label: "USN", className: "font-mono text-xs font-semibold text-slate-600" },
    { key: "name", label: "Student", className: "font-medium text-slate-800" },
    { key: "subject_code", label: "Subject", className: "font-mono text-xs text-indigo-600 font-bold" },
    { key: "risk_level", label: "Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
    {
      key: "pass_probability", label: "Pass Probability",
      render: (r) => (
        <span className={`font-semibold ${r.pass_probability < 55 ? "text-rose-600" : "text-amber-600"}`}>
          {r.pass_probability}%
        </span>
      ),
    },
    {
      key: "action", label: "Intervention",
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.risk_level === "High" ? "1:1 mentoring + notify parent" : "Extra assignments & attendance watch"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="At-Risk Students" subtitle="Flagged by the XGBoost model across your assigned classes" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="High Risk" value={high} icon="risk" tone="rose" />
        <StatCard label="Medium Risk" value={students.length - high} icon="risk" tone="amber" />
        <StatCard label="Total Flagged" value={students.length} icon="students" tone="indigo" />
      </div>
      <Card>
        <DataTable columns={columns} rows={students} rowKey="usn" empty="No at-risk students in your classes 🎉" />
      </Card>
    </div>
  );
}
