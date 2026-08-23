import { useState } from "react";
import api from "../../services/api";
import useFetch from "../../hooks/useFetch";
import {
  Badge, Card, DataTable, Field, inputCls, Modal, PageHeader, PrimaryButton, Spinner,
} from "../../components/ui";

const emptyForm = {
  name: "", email: "", employee_id: "", password: "Teacher@123",
  department_id: "", designation: "Assistant Professor", phone: "", subject_ids: [],
};

export default function ManageTeachers() {
  const { data, loading, reload } = useFetch("/admin/teachers");
  const { data: deptData } = useFetch("/admin/departments");
  const { data: subjData } = useFetch("/admin/subjects");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const departments = deptData?.departments || [];
  const subjects = subjData?.subjects || [];

  const toggleSubject = (id) =>
    setForm((f) => ({
      ...f,
      subject_ids: f.subject_ids.includes(id)
        ? f.subject_ids.filter((s) => s !== id)
        : [...f.subject_ids, id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.post("/admin/teachers", {
        ...form,
        department_id: Number(form.department_id || departments[0]?.id),
      });
      setModal(false);
      setForm(emptyForm);
      reload();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to create teacher");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    await api.delete(`/admin/teachers/${row.id}`);
    reload();
  };

  const columns = [
    { key: "employee_id", label: "Emp ID", className: "font-mono text-xs text-slate-500" },
    { key: "name", label: "Name", className: "font-medium text-slate-800" },
    { key: "email", label: "Email", className: "text-slate-500" },
    { key: "department", label: "Dept" },
    { key: "designation", label: "Designation", className: "text-slate-500" },
    {
      key: "subjects", label: "Assigned Subjects",
      render: (r) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {r.subjects?.length
            ? r.subjects.map((s) => <Badge key={s.code} tone="indigo">{s.code}</Badge>)
            : <span className="text-xs text-slate-400">None</span>}
        </div>
      ),
    },
    { key: "actions", label: "", render: (r) => <button onClick={() => remove(r)} className="text-xs font-medium text-rose-500 hover:text-rose-700">Delete</button> },
  ];

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle={`${data?.count ?? 0} faculty members`}
        actions={<PrimaryButton onClick={() => setModal(true)}>+ Add Teacher</PrimaryButton>}
      />
      {loading ? (
        <Spinner />
      ) : (
        <Card>
          <DataTable columns={columns} rows={data?.teachers || []} />
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add New Teacher" width="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name">
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Employee ID">
              <input required className={inputCls} placeholder="EMP106" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
            </Field>
            <Field label="Password">
              <input required className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Department">
              <select className={inputCls} value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Designation">
              <select className={inputCls} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                <option>Assistant Professor</option><option>Associate Professor</option><option>Professor</option>
              </select>
            </Field>
          </div>
          <Field label={`Assign Subjects (${form.subject_ids.length} selected)`}>
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {subjects.map((s) => (
                <label key={s.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer ring-1 transition ${form.subject_ids.includes(s.id) ? "bg-indigo-50 ring-indigo-300 text-indigo-700 font-semibold" : "ring-slate-200 hover:bg-slate-50"}`}>
                  <input type="checkbox" className="accent-indigo-600" checked={form.subject_ids.includes(s.id)} onChange={() => toggleSubject(s.id)} />
                  {s.code} · {s.name}
                </label>
              ))}
            </div>
          </Field>
          {formError && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200">{formError}</p>}
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving..." : "Create Teacher"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
