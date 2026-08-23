import { useState } from "react";
import api from "../../services/api";
import useFetch from "../../hooks/useFetch";
import { ImportanceBar } from "../../components/charts";
import {
  Card, Field, inputCls, PageHeader, PrimaryButton, RiskBadge, Spinner, StatCard,
} from "../../components/ui";

const CLASSES = ["High", "Low", "Medium"]; // label-encoder order from training

export default function MLAnalytics() {
  const { data: metrics, loading } = useFetch("/ml/model-metrics");
  const { data: imp } = useFetch("/ml/feature-importance");

  const [form, setForm] = useState({
    attendance_percentage: 85, assignment_marks: 8, previous_sem_sgpa: 8.2,
    cgpa: 8.1, backlogs: 0, ia1: 42, ia2: 44,
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const runPrediction = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/ml/predict", Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, Number(v)])
      ));
      setResult(data);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading model metrics..." />;

  const cls = metrics?.classifier || {};
  const reg = metrics?.regressor || {};
  const cm = cls.confusion_matrix || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ML Analytics"
        subtitle={metrics?.algorithm || "XGBoost risk model"}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Accuracy" value={cls.accuracy ? `${(cls.accuracy * 100).toFixed(1)}%` : "—"} icon="attendance" tone="emerald" hint={`${metrics?.test_samples} test samples`} />
        <StatCard label="F1 (weighted)" value={cls.f1_weighted ?? "—"} icon="sgpa" tone="indigo" hint={`Precision ${cls.precision_weighted}`} />
        <StatCard label="Pass-prob R²" value={reg.r2 ?? "—"} icon="cgpa" tone="sky" hint={`RMSE ${reg.rmse}`} />
        <StatCard label="Training Samples" value={metrics?.samples ?? "—"} icon="report" tone="violet" hint="Synthetic academic dataset" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Feature Importance" subtitle="Gain contribution of each feature (XGBoost classifier)">
          <ImportanceBar data={imp?.feature_importance} />
        </Card>

        <Card title="Confusion Matrix" subtitle="Rows = actual · Columns = predicted">
          <div className="grid place-items-center">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  {CLASSES.map((c) => (
                    <th key={c} className="p-2 text-xs font-semibold text-slate-500">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cm.map((row, i) => (
                  <tr key={i}>
                    <td className="p-2 text-xs font-semibold text-slate-500">{CLASSES[i]}</td>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className={`p-2 text-center rounded-lg font-semibold ${
                          i === j ? "bg-indigo-600 text-white" : v > 0 ? "bg-rose-50 text-rose-600" : "text-slate-300"
                        }`}
                        style={{ minWidth: 52 }}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cls.report && (
            <pre className="mt-4 text-[11px] leading-relaxed bg-slate-950 text-slate-300 rounded-xl p-4 overflow-x-auto">
              {cls.report}
            </pre>
          )}
        </Card>
      </div>

      <Card title="Try the Prediction API" subtitle="Same XGBoost model that powers every dashboard — POST /api/ml/predict">
        <form onSubmit={runPrediction} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          {[
            ["attendance_percentage", "Attendance %"],
            ["assignment_marks", "Assign (10)"],
            ["previous_sem_sgpa", "Prev SGPA"],
            ["cgpa", "CGPA"],
            ["backlogs", "Backlogs"],
            ["ia1", "IA1 (50)"],
            ["ia2", "IA2 (50)"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="number" step="0.1" className={inputCls} value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
          <PrimaryButton type="submit" disabled={busy} className="col-span-2 sm:col-span-1">
            {busy ? "..." : "Predict"}
          </PrimaryButton>
        </form>
        {result && (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-5 py-4">
            <RiskBadge level={result.risk_level} />
            <div>
              <p className="text-xs text-slate-500">Pass probability</p>
              <p className="text-lg font-bold text-slate-900">{result.pass_probability}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Model confidence</p>
              <p className="text-lg font-bold text-slate-900">{result.confidence}%</p>
            </div>
            <div className="text-xs text-slate-500">
              Class probabilities:{" "}
              {Object.entries(result.class_probabilities || {})
                .map(([k, v]) => `${k} ${v}%`)
                .join(" · ")}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
