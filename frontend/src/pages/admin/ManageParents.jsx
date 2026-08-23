import { useState } from "react";
import api from "../../services/api";
import useFetch from "../../hooks/useFetch";
import {
  Badge, Card, DataTable, Field, inputCls, Modal, PageHeader, PrimaryButton, Spinner,
} from "../../components/ui";

export default function ManageParents() {
  const { data, loading, reload } = useFetch("/admin/parents");
  const { data: studentData } = useFetch("/admin/students");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "Parent@123", phone: "", occupation: "", relation: "Guardian", student_ids: [] });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const students = studentData?.students || [];

  const toggleStudent = (id) =>
    setForm((f) => ({
      ...f,
      student_ids: f.student_ids.includes(id)
        ? f.student_ids.filter((s) => s !== id)
        : [...f.student_ids, id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api.post("/admin/parents", form);
      setModal(false);
      setForm({ name: "", email: "", password: "Parent@123", phone: "", occupation: "", relation: "Guardian", student_ids: [] });
      reload();
    } catch (e2) {
      setErr(e2.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "name", label: "Parent", className: "font-medium text-slate-800" },
    { key: "email", label: "Email", className: "text-slate-500" },
    { key: "phone", label: "Phone", className: "text-slate-500" },
    { key: "occupation", label: "Occupation", className: "text-slate-500" },
    {
      key: "children", label: "Children",
      render: (r) => (
        <div className="flex flex-wrap gap-1 max-w-sm">
          {r.children?.length
            ? r.children.map((c, i) => <Badge key={i} tone="violet">{c.name} · {c.usn}</Badge>)
            : <span className="text-xs text-slate-400">None linked</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Parents"
        subtitle={`${data?.count ?? 0} guardian accounts (read-only portal access)`}
        actions={<PrimaryButton onClick={() => setModal(true)}>+ Add Parent</PrimaryButton>}
      />
      {loading ? (
        <Spinner />
      ) : (
        <Card>
          <DataTable columns={columns} rows={data?.parents || []} />
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Parent" width="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name">
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password">
              <input required className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Relation">
              <select className={inputCls} value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
                <option>Father</option><option>Mother</option><option>Guardian</option>
              </select>
            </Field>
          </div>
          <Field label={`Link Children (${form.student_ids.length})`}>
            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {students.map((s) => (
                <label key={s.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer ring-1 transition ${form.student_ids.includes(s.id) ? "bg-violet-50 ring-violet-300 text-violet-700 font-semibold" : "ring-slate-200 hover:bg-slate-50"}`}>
                  <input type="checkbox" className="accent-violet-600" checked={form.student_ids.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  {s.name} <span className="text-slate-400 font-mono">{s.usn}</span>
                </label>
              ))}
            </div>
          </Field>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving..." : "Create Parent"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
