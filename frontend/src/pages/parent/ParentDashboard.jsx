import { useState } from "react";
import {
  AcademicCharts, AcademicKpis, BacklogList, IAChart, RiskCard,
} from "../../components/AcademicView";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function ParentDashboard() {
  const { data, loading, error } = useFetch("/parent/dashboard");
  const [active, setActive] = useState(0);

  if (loading) return <Spinner label="Loading your ward's academics..." />;
  if (error) return <EmptyState title="Could not load" hint={error} />;

  const children = data?.children || [];
  const child = children[active];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Portal"
        subtitle={`${data?.parent?.name} · read-only academic view`}
        actions={<Badge tone="violet">{children.length} ward{children.length !== 1 ? "s" : ""} linked</Badge>}
      />

      {children.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {children.map((c, i) => (
            <button
              key={c.profile.usn}
              onClick={() => setActive(i)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition ${
                i === active
                  ? "bg-indigo-600 text-white ring-indigo-600 shadow-md shadow-indigo-600/25"
                  : "bg-white text-slate-600 ring-slate-200 hover:ring-indigo-300"
              }`}
            >
              {c.profile.name} <span className="font-mono text-xs opacity-70">{c.profile.usn}</span>
            </button>
          ))}
        </div>
      )}

      {!child ? (
        <Card><EmptyState title="No children linked" hint="Ask the admin to link your ward's account." /></Card>
      ) : (
        <>
          {/* Child profile strip */}
          <Card>
            <div className="flex flex-wrap items-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 grid place-items-center text-white text-xl font-extrabold">
                {child.profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-10 gap-y-2 flex-1">
                <Meta label="Student" value={child.profile.name} />
                <Meta label="USN" value={child.profile.usn} mono />
                <Meta label="Department" value={child.profile.department} />
                <Meta label="Semester" value={`Sem ${child.profile.semester} · Sec ${child.profile.section}`} />
                <Meta label="Relation" value={child.relation} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <AcademicKpis summary={child} />
              <AcademicCharts summary={child} />
              <IAChart summary={child} />
              <BacklogList summary={child} />
            </div>
            <div className="space-y-4">
              <RiskCard prediction={child.prediction} />
              <Card title="Note for parents">
                <p className="text-xs text-slate-500 leading-relaxed">
                  This portal is <b>read-only</b>. The risk score above is generated
                  by an XGBoost machine-learning model from your ward's attendance,
                  IA marks, assignments, CGPA and backlogs. If the risk is Medium or
                  High, please contact the class teacher or mentor.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
