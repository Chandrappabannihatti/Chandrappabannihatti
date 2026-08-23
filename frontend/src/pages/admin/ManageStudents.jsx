import { useEffect, useState } from "react";
import api from "../../services/api";
import useFetch from "../../hooks/useFetch";
import {
  AttendanceBar,
  Card,
  DataTable,
  EmptyState,
  Field,
  inputCls,
  Modal,
  PageHeader,
  PrimaryButton,
  RiskBadge,
  Spinner,
} from "../../components/ui";

const emptyForm = {
  name: "", email: "", usn: "", password: "Student@123",
  department_id: "", semester: 5, section: "A", gender: "Male", phone: "",
};

export default function ManageStudents() {
  const [filters, setFilters] = useState({ search: "", department: "", risk: "" });
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  ).toString();
  const { data, loading, reload } = useFetch(`/admin/students?${query}`);
  const { data: deptData } = useFetch("/admin/departments");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const departments = deptData?.departments || [];

  // Default department once loaded
  useEffect(() => {
    if (departments.length && !form.department_id) {
      setForm((f) => ({ ...f, department_id: departments[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments.length]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.post("/admin/students", { ...form, semester: Number(form.semester) });
      setModal(false);
      setForm(emptyForm);
      reload();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to create student");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name} (${row.usn})? This removes their login too.`)) return;
    await api.delete(`/admin/students/${row.id}`);
    reload();
  };

  const columns = [
    { key: "usn", label: "USN", className: "font-mono text-xs font-semibold text-slate-600" },
    { key: "name", label: "Name", className: "font-medium text-slate-800" },
    { key: "department", label: "Dept" },
    { key: "semester", label: "Sem" },
    { key: "attendance_percentage", label: "Attendance", render: (r) => <AttendanceBar value={r.attendance_percentage} /> },
    { key: "cgpa", label: "CGPA", render: (r) => <span className="font-semibold text-slate-700">{r.cgpa}</span> },
    { key: "backlogs", label: "Backlogs", render: (r) => (r.backlogs > 0 ? <span className="text-rose-600 font-semibold">{r.backlogs}</span> : <span className="text-slate-400">0</span>) },
    { key: "risk_level", label: "ML Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
    { key: "pass_probability", label: "Pass %", render: (r) => (r.pass_probability != null ? `${r.pass_probability}%` : "—") },
    {
      key: "actions", label: "", render: (r) => (
        <button onClick={() => remove(r)} className="text-xs font-medium text-rose-500 hover:text-rose-700">Delete</button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${data?.count ?? 0} students with live ML risk scores`}
        actions={<PrimaryButton onClick={() => setModal(true)}>+ Add Student</PrimaryButton>}
      />

      {loading ? (
        <Spinner />
      ) : (
        <Card
          actions={
            <div className="flex flex-wrap gap-2">
              <input
                placeholder="Search name / USN..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className={`${inputCls} !w-52`}
              />
              <select
                value={filters.department}
                onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
                className={`${inputCls} !w-32`}
              >
                <option value="">All Depts</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.code}>{d.code}</option>
                ))}
              </select>
              <select
                value={filters.risk}
                onChange={(e) => setFilters((f) => ({ ...f, risk: e.target.value }))}
                className={`${inputCls} !w-32`}
              >
                <option value="">All Risk</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          }
        >
          <DataTable columns={columns} rows={data?.students || []} empty="No students match the filters" />
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add New Student">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field label="Full Name">
            <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="USN">
            <input required className={inputCls} placeholder="1CR23CS021" value={form.usn} onChange={(e) => setForm({ ...form, usn: e.target.value })} />
          </Field>
          <Field label="Password">
            <input required className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Department">
            <select className={inputCls} value={form.department_id} onChange={(e) => setForm({ ...form, department_id: Number(e.target.value) })}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select className={inputCls} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </Field>
          <Field label="Gender">
            <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          {formError && <p className="col-span-2 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200">{formError}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving..." : "Create Student"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
