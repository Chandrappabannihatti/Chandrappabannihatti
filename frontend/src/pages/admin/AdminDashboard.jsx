import { Link } from "react-router-dom";
import { DeptBar, RiskPie } from "../../components/charts";
import { Card, EmptyState, PageHeader, RiskBadge, Spinner, StatCard } from "../../components/ui";
import useFetch from "../../hooks/useFetch";

const KIND_DOT = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

export default function AdminDashboard() {
  const { data, loading, error } = useFetch("/admin/dashboard");

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (error) return <EmptyState title="Could not load dashboard" hint={error} />;

  const { kpis, risk_distribution, dept_performance, recent_predictions, recent_activities } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Institution-wide academic health, powered by the XGBoost risk model."
        actions={
          <div className="flex gap-2">
            <Link to="/admin/students" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-sm">
              + Add Student
            </Link>
            <Link to="/admin/reports" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              View Reports
            </Link>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <StatCard label="Students" value={kpis.total_students} icon="students" tone="indigo" hint="Enrolled this AY" />
        <StatCard label="Teachers" value={kpis.total_teachers} icon="teachers" tone="sky" hint={`${kpis.total_subjects} subjects`} />
        <StatCard label="Parents" value={kpis.total_parents} icon="parents" tone="violet" hint="Linked guardians" />
        <StatCard label="Avg Attendance" value={kpis.avg_attendance} suffix="%" icon="attendance" tone="emerald" hint="All departments" />
        <StatCard label="Avg SGPA" value={kpis.avg_sgpa} icon="sgpa" tone="amber" hint="Semester 1-4" />
        <StatCard label="At Risk" value={kpis.at_risk} icon="risk" tone="rose" hint="High-risk students" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card title="Student Risk Distribution" subtitle="Latest XGBoost prediction per student" className="xl:col-span-2">
          <RiskPie data={risk_distribution} />
        </Card>
        <Card title="Department Performance" subtitle="Average SGPA vs average attendance" className="xl:col-span-3">
          <DeptBar data={dept_performance} />
        </Card>
      </div>

      {/* Activity + predictions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Recent ML Predictions" subtitle="Newest risk assessments">
          {recent_predictions.length === 0 ? (
            <EmptyState title="No predictions yet" />
          ) : (
            <ul className="divide-y divide-slate-100 -mx-5">
              {recent_predictions.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-9 w-9 rounded-full bg-slate-100 grid place-items-center text-xs font-bold text-slate-500">
                    {p.student?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.student}</p>
                    <p className="text-xs text-slate-400">{p.usn} · pass probability {p.pass_probability}%</p>
                  </div>
                  <RiskBadge level={p.risk_level} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Activity" subtitle="System events and alerts">
          {recent_activities.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-3">
              {recent_activities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${KIND_DOT[a.kind] || "bg-slate-400"}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Manage Students", "/admin/students", "bg-indigo-50 text-indigo-700 ring-indigo-200"],
            ["Manage Teachers", "/admin/teachers", "bg-sky-50 text-sky-700 ring-sky-200"],
            ["At-Risk Report", "/admin/reports", "bg-rose-50 text-rose-700 ring-rose-200"],
            ["ML Analytics", "/admin/ml-analytics", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
          ].map(([label, to, cls]) => (
            <Link
              key={to}
              to={to}
              className={`rounded-xl px-4 py-3 text-sm font-semibold text-center ring-1 transition hover:shadow-md ${cls}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
