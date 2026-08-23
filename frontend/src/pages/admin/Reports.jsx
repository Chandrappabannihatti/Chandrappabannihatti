import { DeptBar } from "../../components/charts";
import {
  AttendanceBar, Card, DataTable, PageHeader, RiskBadge, Spinner, StatCard,
} from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function Reports() {
  const { data: riskData, loading: rLoad } = useFetch("/admin/reports/at-risk");
  const { data: deptData, loading: dLoad } = useFetch("/admin/reports/department");

  if (rLoad || dLoad) return <Spinner label="Building reports..." />;

  const students = riskData?.students || [];
  const high = students.filter((s) => s.risk_level === "High").length;
  const medium = students.filter((s) => s.risk_level === "Medium").length;

  const columns = [
    { key: "usn", label: "USN", className: "font-mono text-xs font-semibold text-slate-600" },
    { key: "name", label: "Student", className: "font-medium text-slate-800" },
    { key: "department", label: "Dept" },
    { key: "attendance_percentage", label: "Attendance", render: (r) => <AttendanceBar value={r.attendance_percentage} /> },
    { key: "cgpa", label: "CGPA" },
    { key: "backlogs", label: "Backlogs" },
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
      key: "action", label: "Suggested Action",
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.risk_level === "High" ? "Counselling + parent meeting" : "Monitor attendance & IA"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="At-risk register and department performance" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="High Risk" value={high} icon="risk" tone="rose" hint="Immediate intervention" />
        <StatCard label="Medium Risk" value={medium} icon="risk" tone="amber" hint="Needs monitoring" />
        <StatCard label="Departments" value={deptData?.departments?.length || 0} icon="class" tone="indigo" hint="CSE · ISE · ECE" />
      </div>

      <Card title="Department Performance" subtitle="Comparative view">
        <DeptBar data={deptData?.departments} />
      </Card>

      <Card title="At-Risk Student Register" subtitle={`${students.length} students flagged by the XGBoost model`}>
        <DataTable columns={columns} rows={students} empty="No at-risk students 🎉" />
      </Card>
    </div>
  );
}
