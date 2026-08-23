import { SgpaTrend, IABar } from "../../components/charts";
import {
  Badge, Card, DataTable, EmptyState, PageHeader, Spinner,
} from "../../components/ui";
import useFetch from "../../hooks/useFetch";

export default function ResultsPage() {
  const { data, loading } = useFetch("/student/results");
  if (loading) return <Spinner label="Loading results..." />;

  const trend = (data?.results || []).map((r) => ({
    semester: `Sem ${r.semester}`, sgpa: r.sgpa, cgpa: r.cgpa,
  }));

  const resultCols = [
    { key: "semester", label: "Semester", render: (r) => <b>Sem {r.semester}</b> },
    { key: "sgpa", label: "SGPA", render: (r) => <span className="font-bold text-indigo-600">{r.sgpa}</span> },
    { key: "cgpa", label: "CGPA", render: (r) => <span className="font-semibold text-slate-700">{r.cgpa}</span> },
    { key: "grade", label: "Performance", render: (r) => (r.sgpa >= 9 ? <Badge tone="emerald">Outstanding</Badge> : r.sgpa >= 7.5 ? <Badge tone="indigo">First Class</Badge> : r.sgpa >= 6 ? <Badge tone="amber">Second Class</Badge> : <Badge tone="rose">Needs Improvement</Badge>) },
  ];

  const iaCols = [
    { key: "subject_code", label: "Code", className: "font-mono text-xs font-bold text-indigo-600" },
    { key: "subject_name", label: "Subject", className: "font-medium text-slate-800" },
    { key: "ia1", label: "IA 1 / 50" },
    { key: "ia2", label: "IA 2 / 50" },
    { key: "avg", label: "Average", render: (r) => <b>{r.avg}</b> },
  ];

  const asgCols = [
    { key: "subject_code", label: "Code", className: "font-mono text-xs font-bold text-indigo-600" },
    { key: "subject_name", label: "Subject", className: "font-medium text-slate-800" },
    { key: "marks", label: "Marks / 10", render: (r) => <b>{r.marks}</b> },
  ];

  const backlogCols = [
    { key: "subject_code", label: "Code", className: "font-mono text-xs font-bold text-indigo-600" },
    { key: "subject_name", label: "Subject", className: "font-medium text-slate-800" },
    { key: "semester", label: "Semester" },
    { key: "status", label: "Status", render: (r) => (r.status === "active" ? <Badge tone="rose">Active</Badge> : <Badge tone="emerald">Cleared</Badge>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Results & Marks" subtitle="Semester results, internal assessments and assignments" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="SGPA / CGPA Trend">
          <SgpaTrend data={trend} />
        </Card>
        <Card title="Semester Results">
          <DataTable columns={resultCols} rows={data?.results || []} rowKey="semester" empty="No results published yet" />
        </Card>
      </div>
      <Card title="IA Marks Chart">
        <IABar data={data?.ia_marks} />
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Internal Assessment Records">
          <DataTable columns={iaCols} rows={data?.ia_marks || []} rowKey="subject_code" empty="No IA marks yet" />
        </Card>
        <Card title="Assignment Marks">
          <DataTable columns={asgCols} rows={data?.assignments || []} rowKey="subject_code" empty="No assignments yet" />
        </Card>
      </div>
      {data?.backlogs?.length > 0 ? (
        <Card title="Backlogs">
          <DataTable columns={backlogCols} rows={data.backlogs} rowKey="subject_code" />
        </Card>
      ) : (
        <Card><EmptyState title="No backlogs 🎉" hint="You have cleared every subject so far." /></Card>
      )}
    </div>
  );
}
