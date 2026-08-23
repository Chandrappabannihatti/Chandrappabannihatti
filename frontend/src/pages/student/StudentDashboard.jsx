import { Link } from "react-router-dom";
import { AcademicCharts, AcademicKpis, RiskCard } from "../../components/AcademicView";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function StudentDashboard() {
  const { data, loading, error } = useFetch("/student/dashboard");

  if (loading) return <Spinner label="Loading your academic profile..." />;
  if (error) return <EmptyState title="Could not load dashboard" hint={error} />;
  const p = data.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${p.name.split(" ")[0]}`}
        subtitle={`${p.usn} · ${p.department} · Semester ${p.semester} · Section ${p.section}`}
        actions={<Badge tone="indigo">{p.email}</Badge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <AcademicKpis summary={data} />
          <AcademicCharts summary={data} />
        </div>
        <div className="space-y-4">
          <RiskCard prediction={data.prediction} />
          <Card title="Quick Links">
            <div className="space-y-2">
              {[
                ["View detailed attendance", "/student/attendance"],
                ["Results, IA & assignments", "/student/results"],
                ["Understand my risk score", "/student/prediction"],
              ].map(([label, to]) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between rounded-xl ring-1 ring-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:ring-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 transition"
                >
                  {label}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </Card>
          <Card title="How is risk computed?">
            <p className="text-xs text-slate-500 leading-relaxed">
              An <b>XGBoost classifier</b> trained on academic history scores your
              attendance, IA marks, assignments, CGPA, previous SGPA and backlogs
              to predict a <b>Low / Medium / High</b> risk level along with your
              pass probability. It refreshes automatically whenever teachers
              upload new data.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
