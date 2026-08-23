import { RiskCard } from "../../components/AcademicView";
import { ImportanceBar } from "../../components/charts";
import { Card, PageHeader, Spinner } from "../../components/ui";
import useFetch from "../../hooks/useFetch";

const FEATURE_META = {
  attendance_percentage: ["Attendance %", (v) => `${v}%`],
  assignment_marks: ["Assignment Avg", (v) => `${v} / 10`],
  previous_sem_sgpa: ["Previous SGPA", (v) => v],
  cgpa: ["CGPA", (v) => v],
  backlogs: ["Active Backlogs", (v) => v],
  ia1: ["IA 1 Average", (v) => `${v} / 50`],
  ia2: ["IA 2 Average", (v) => `${v} / 50`],
  avg_ia: ["Avg IA", (v) => `${v} / 50`],
};

export default function PredictionPage() {
  const { data, loading } = useFetch("/student/prediction");
  const { data: imp } = useFetch("/ml/feature-importance");

  if (loading) return <Spinner label="Running the model on your latest data..." />;

  const features = data?.features || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Risk Prediction"
        subtitle="Computed live from your latest attendance, marks and results via XGBoost"
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <RiskCard prediction={data} />
        <Card
          className="xl:col-span-2"
          title="Your Model Inputs"
          subtitle="These features were extracted from the database moments ago"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(FEATURE_META).map(([key, [label, fmt]]) => (
              <div key={key} className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{fmt(features[key] ?? 0)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="What drives this prediction?" subtitle="Global feature importance of the trained model">
          <ImportanceBar data={imp?.feature_importance} />
        </Card>
        <Card title="How to improve" subtitle="Actionable guidance based on your inputs">
          <ul className="space-y-3">
            {(features.attendance_percentage ?? 100) < 75 && (
              <Tip tone="rose" text={`Attendance is ${features.attendance_percentage}% — get above 75% first; every extra class attended moves the needle.`} />
            )}
            {(features.avg_ia ?? 50) < 30 && (
              <Tip tone="amber" text={`Your IA average is ${features.avg_ia}/50. Scoring 35+ in the next IA significantly lowers risk.`} />
            )}
            {(features.backlogs ?? 0) > 0 && (
              <Tip tone="rose" text={`${features.backlogs} active backlog(s) weigh heavily on the model. Clearing them is the fastest way to drop a risk band.`} />
            )}
            {(features.assignment_marks ?? 10) < 7 && (
              <Tip tone="amber" text={`Assignment average is ${features.assignment_marks}/10 — submit every pending assignment.`} />
            )}
            {(features.attendance_percentage ?? 0) >= 75 && (features.avg_ia ?? 0) >= 30 && (features.backlogs ?? 0) === 0 && (features.assignment_marks ?? 0) >= 7 && (
              <Tip tone="emerald" text="You're on track across all key inputs — keep the momentum through the final IA and semester exams." />
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Tip({ tone, text }) {
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <li className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>{text}</li>
  );
}
