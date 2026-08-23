/* Reusable blocks that render a student's academic snapshot.
   Used by the student dashboard and (read-only) the parent dashboard. */
import { SgpaTrend, SubjectAttendanceBar, IABar } from "./charts";
import { Card, RiskBadge, StatCard } from "./ui";

const RISK_PANEL = {
  Low: "from-emerald-500 to-teal-500",
  Medium: "from-amber-500 to-orange-500",
  High: "from-rose-500 to-red-500",
};

export function RiskCard({ prediction }) {
  if (!prediction?.risk_level) {
    return (
      <div className="rounded-2xl bg-slate-900 text-white p-6 ring-1 ring-slate-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">ML Risk Prediction</p>
        <p className="mt-3 text-sm text-slate-400">Not enough academic data yet to run the model.</p>
      </div>
    );
  }
  const grad = RISK_PANEL[prediction.risk_level] || "from-slate-500 to-slate-600";
  const prob = prediction.class_probabilities || {};
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} text-white p-6 shadow-lg`}>
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">ML Risk Prediction</p>
        <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">XGBoost</span>
      </div>
      <p className="mt-3 text-3xl font-extrabold">{prediction.risk_level} Risk</p>
      <p className="text-sm text-white/85 mt-0.5">
        Pass probability: <b>{prediction.pass_probability}%</b>
      </p>
      <div className="mt-4 h-2.5 rounded-full bg-white/25 overflow-hidden">
        <div className="h-full rounded-full bg-white" style={{ width: `${prediction.pass_probability}%` }} />
      </div>
      {Object.keys(prob).length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {["Low", "Medium", "High"].map((k) => (
            <div key={k} className="rounded-lg bg-white/15 py-1.5">
              <p className="text-xs font-bold">{prob[k] ?? 0}%</p>
              <p className="text-[10px] text-white/70">{k}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AcademicKpis({ summary }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard label="Attendance" value={summary.attendance_percentage} suffix="%" icon="attendance"
        tone={summary.attendance_percentage >= 75 ? "emerald" : "rose"}
        hint={summary.attendance_percentage >= 75 ? "Above 75% threshold" : "Below 75% threshold!"} />
      <StatCard label="Latest SGPA" value={summary.sgpa} icon="sgpa" tone="indigo" hint="Most recent semester" />
      <StatCard label="CGPA" value={summary.cgpa} icon="cgpa" tone="sky" hint="Cumulative average" />
      <StatCard label="Backlogs" value={summary.backlogs} icon="backlogs"
        tone={summary.backlogs > 0 ? "rose" : "emerald"}
        hint={summary.backlogs > 0 ? "Active backlog subjects" : "All clear"} />
    </div>
  );
}

export function AcademicCharts({ summary }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card title="Subject-wise Attendance" subtitle="Current semester">
        <SubjectAttendanceBar data={summary.subject_attendance} />
      </Card>
      <Card title="SGPA Trend" subtitle="Semester over semester">
        <SgpaTrend data={summary.sgpa_trend} />
      </Card>
    </div>
  );
}

export function IAChart({ summary }) {
  return (
    <Card title="Internal Assessment Marks" subtitle="IA 1 vs IA 2 (out of 50)">
      <IABar data={summary.ia_marks} />
    </Card>
  );
}

export function BacklogList({ summary }) {
  if (!summary.backlog_detail?.length) return null;
  return (
    <Card title="Backlog Subjects" subtitle="Active and cleared">
      <ul className="divide-y divide-slate-100 -mx-5">
        {summary.backlog_detail.map((b, i) => (
          <li key={i} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{b.subject_name}</p>
              <p className="text-xs text-slate-400">{b.subject_code} · Semester {b.semester}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${
              b.status === "active"
                ? "bg-rose-50 text-rose-600 ring-rose-200"
                : "bg-emerald-50 text-emerald-600 ring-emerald-200"
            }`}>
              {b.status}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export { RiskBadge };
