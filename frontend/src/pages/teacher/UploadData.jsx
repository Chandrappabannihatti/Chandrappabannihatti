import { useRef, useState } from "react";
import api from "../../services/api";
import {
  Card, DataTable, GhostButton, PageHeader, PrimaryButton, Badge,
} from "../../components/ui";

const TYPES = [
  {
    key: "attendance",
    label: "Attendance",
    desc: "Classes held & attended per subject",
    cols: ["USN", "SubjectCode", "Semester", "ClassesHeld", "ClassesAttended"],
  },
  {
    key: "ia",
    label: "IA Marks",
    desc: "Internal assessment 1 & 2 (out of 50)",
    cols: ["USN", "SubjectCode", "Semester", "IA1", "IA2"],
  },
  {
    key: "assignment",
    label: "Assignments",
    desc: "Assignment marks (out of 10)",
    cols: ["USN", "SubjectCode", "Semester", "AssignmentMarks"],
  },
];

export default function UploadData() {
  const [type, setType] = useState("attendance");
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const spec = TYPES.find((t) => t.key === type);

  const pick = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError("");
  };

  const send = async (mode) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const { data } = await api.post(`/teacher/upload/${type}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (mode === "preview") {
        setPreview(data);
        setResult(null);
      } else {
        setResult(data);
        setPreview(null);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    const res = await api.get(`/teacher/upload/template/${type}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewCols = preview
    ? [
        { key: "row", label: "Row", className: "text-xs text-slate-400" },
        ...spec.cols.map((c) => ({
          key: c.toLowerCase().replace("subjectcode", "subject_code").replace("classesheld", "classes_held").replace("classesattended", "classes_attended").replace("assignmentmarks", "assignment_marks"),
          label: c,
        })),
        {
          key: "_status", label: "Status",
          render: (r) =>
            r._status === "ok"
              ? <Badge tone="emerald">Ready</Badge>
              : <span className="text-xs text-rose-600 font-medium">{r._error}</span>,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Academic Data"
        subtitle="Validate, preview and import Excel/CSV files — predictions refresh automatically after import."
      />

      {/* Type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => { setType(t.key); setPreview(null); setResult(null); setError(""); }}
            className={`text-left rounded-2xl p-4 ring-1 transition ${
              type === t.key
                ? "bg-indigo-600 text-white ring-indigo-600 shadow-lg shadow-indigo-600/25"
                : "bg-white ring-slate-200 hover:ring-indigo-300 hover:shadow"
            }`}
          >
            <p className={`text-sm font-bold ${type === t.key ? "text-white" : "text-slate-800"}`}>{t.label}</p>
            <p className={`text-xs mt-0.5 ${type === t.key ? "text-indigo-100" : "text-slate-400"}`}>{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Dropzone */}
        <Card title="1 · Choose file" subtitle=".xlsx, .xls or .csv — max 8 MB">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
              drag ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
            }`}
          >
            <svg className="mx-auto h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
            </svg>
            {file ? (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · click to replace</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-700">Drop your file here</p>
                <p className="text-xs text-slate-400">or click to browse</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => send("preview")} disabled={!file || busy}>
              {busy ? "Validating..." : "Validate & Preview"}
            </PrimaryButton>
            <GhostButton onClick={downloadTemplate}>Download template</GhostButton>
          </div>
          {error && (
            <p className="mt-3 text-sm text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Required columns</p>
            <div className="flex flex-wrap gap-1.5">
              {spec.cols.map((c) => <Badge key={c} tone="indigo">{c}</Badge>)}
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card
          className="xl:col-span-2"
          title="2 · Preview & confirm"
          subtitle={preview ? `${preview.valid} of ${preview.total} rows valid` : "Validated rows appear here before anything touches the database"}
          actions={
            preview && (
              <PrimaryButton onClick={() => send("import")} disabled={busy || preview.valid === 0}>
                {busy ? "Importing..." : `Import ${preview.valid} valid rows`}
              </PrimaryButton>
            )
          }
        >
          {result && (
            <div className="mb-4 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
              <p className="text-sm font-bold text-emerald-700">Import complete</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {result.inserted} inserted · {result.updated} updated · {result.skipped} skipped ·
                predictions refreshed for {result.students_updated} students
              </p>
              {result.errors?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-rose-600">Row {e.row}: {e._error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {preview ? (
            <div className="max-h-96 overflow-y-auto rounded-xl ring-1 ring-slate-100">
              <DataTable columns={previewCols} rows={preview.rows} rowKey="row" />
            </div>
          ) : (
            !result && (
              <div className="py-14 text-center text-sm text-slate-400">
                No preview yet — choose a file and click <b>Validate &amp; Preview</b>.
              </div>
            )
          )}
        </Card>
      </div>
    </div>
  );
}
