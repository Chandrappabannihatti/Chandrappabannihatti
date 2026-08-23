import { Link } from "react-router-dom";
import {
  Card, EmptyState, PageHeader, Spinner, StatCard,
} from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function TeacherDashboard() {
  const { data, loading } = useFetch("/teacher/dashboard");

  if (loading) return <Spinner label="Loading your classes..." />;
  const { teacher, kpis, classes } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${teacher.name.split(" ").slice(0, 2).join(" ")}`}
        subtitle={`${teacher.department} · ${kpis.classes} assigned classes this semester`}
        actions={
          <Link to="/teacher/upload" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-sm">
            Upload Attendance / Marks
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="My Classes" value={kpis.classes} icon="class" tone="indigo" />
        <StatCard label="Students" value={kpis.total_students} icon="students" tone="sky" hint="Across my classes" />
        <StatCard label="Avg Attendance" value={kpis.avg_attendance} suffix="%" icon="attendance" tone="emerald" />
        <StatCard label="IA Completion" value={kpis.ia_completion} suffix="%" icon="ia" tone="amber" />
        <StatCard label="At Risk" value={kpis.at_risk} icon="risk" tone="rose" hint="High-risk in my classes" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {classes.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <EmptyState title="No classes assigned" hint="Ask the admin to assign subjects to you." />
          </Card>
        )}
        {classes.map((c) => (
          <Link key={c.id} to={`/teacher/classes/${c.id}`} className="group">
            <div className="h-full bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5 hover:shadow-lg hover:ring-indigo-300 transition">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-bold text-indigo-600">{c.subject_code}</p>
                  <h3 className="mt-1 font-bold text-slate-900 group-hover:text-indigo-700 transition">
                    {c.subject_name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Semester {c.semester} · Section {c.section} · {c.credits} credits
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {c.students_count} students
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-sm font-bold text-slate-800">{c.avg_attendance}%</p>
                  <p className="text-[10px] text-slate-400 uppercase">Attendance</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-sm font-bold text-slate-800">{c.ia_completion}%</p>
                  <p className="text-[10px] text-slate-400 uppercase">IA Done</p>
                </div>
                <div className={`rounded-lg py-2 ${c.at_risk > 0 ? "bg-rose-50" : "bg-slate-50"}`}>
                  <p className={`text-sm font-bold ${c.at_risk > 0 ? "text-rose-600" : "text-slate-800"}`}>{c.at_risk}</p>
                  <p className="text-[10px] text-slate-400 uppercase">At Risk</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
