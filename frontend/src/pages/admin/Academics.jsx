import { useState } from "react";
import api from "../../services/api";
import useFetch from "../../hooks/useFetch";
import {
  Badge, Card, DataTable, Field, inputCls, Modal, PageHeader, PrimaryButton, Spinner, StatCard,
} from "../../components/ui";

export default function Academics() {
  const { data: deptData, loading: dLoad, reload: reloadDepts } = useFetch("/admin/departments");
  const { data: subjData, loading: sLoad, reload: reloadSubjects } = useFetch("/admin/subjects");

  const [subjModal, setSubjModal] = useState(false);
  const [deptModal, setDeptModal] = useState(false);
  const [subjForm, setSubjForm] = useState({ code: "", name: "", semester: 5, credits: 4, department_id: "" });
  const [deptForm, setDeptForm] = useState({ code: "", name: "" });
  const [err, setErr] = useState("");

  const departments = deptData?.departments || [];
  const subjects = subjData?.subjects || [];

  const createSubject = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/admin/subjects", {
        ...subjForm,
        semester: Number(subjForm.semester),
        credits: Number(subjForm.credits),
        department_id: Number(subjForm.department_id || departments[0]?.id),
      });
      setSubjModal(false);
      setSubjForm({ code: "", name: "", semester: 5, credits: 4, department_id: "" });
      reloadSubjects();
      reloadDepts();
    } catch (e2) {
      setErr(e2.response?.data?.error || "Failed");
    }
  };

  const createDept = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/admin/departments", deptForm);
      setDeptModal(false);
      setDeptForm({ code: "", name: "" });
      reloadDepts();
    } catch (e2) {
      setErr(e2.response?.data?.error || "Failed");
    }
  };

  const columns = [
    { key: "code", label: "Code", className: "font-mono text-xs font-bold text-indigo-600" },
    { key: "name", label: "Subject", className: "font-medium text-slate-800" },
    { key: "department", label: "Dept" },
    { key: "semester", label: "Sem" },
    { key: "credits", label: "Credits", render: (r) => <Badge tone="slate">{r.credits} cr</Badge> },
  ];

  if (dLoad || sLoad) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academics"
        subtitle="Departments and subjects across the institution"
        actions={
          <div className="flex gap-2">
            <PrimaryButton onClick={() => setSubjModal(true)}>+ Add Subject</PrimaryButton>
            <button onClick={() => setDeptModal(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              + Add Department
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {departments.map((d) => (
          <StatCard key={d.id} label={d.code} value={d.students} icon="class" tone="indigo"
            hint={`${d.subjects} subjects · ${d.teachers} teachers`} />
        ))}
      </div>

      <Card title="Subjects" subtitle={`${subjects.length} subjects`}>
        <DataTable columns={columns} rows={subjects} />
      </Card>

      <Modal open={subjModal} onClose={() => setSubjModal(false)} title="Add Subject">
        <form onSubmit={createSubject} className="grid grid-cols-2 gap-4">
          <Field label="Subject Code">
            <input required className={inputCls} placeholder="CS505" value={subjForm.code} onChange={(e) => setSubjForm({ ...subjForm, code: e.target.value })} />
          </Field>
          <Field label="Subject Name">
            <input required className={inputCls} placeholder="Deep Learning" value={subjForm.name} onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })} />
          </Field>
          <Field label="Department">
            <select className={inputCls} value={subjForm.department_id} onChange={(e) => setSubjForm({ ...subjForm, department_id: e.target.value })}>
              <option value="">Select</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <select className={inputCls} value={subjForm.semester} onChange={(e) => setSubjForm({ ...subjForm, semester: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </Field>
          <Field label="Credits">
            <input type="number" min="1" max="6" className={inputCls} value={subjForm.credits} onChange={(e) => setSubjForm({ ...subjForm, credits: e.target.value })} />
          </Field>
          {err && <p className="col-span-2 text-sm text-rose-600">{err}</p>}
          <div className="col-span-2 flex justify-end">
            <PrimaryButton type="submit">Create Subject</PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal open={deptModal} onClose={() => setDeptModal(false)} title="Add Department">
        <form onSubmit={createDept} className="space-y-4">
          <Field label="Code">
            <input required className={inputCls} placeholder="ME" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} />
          </Field>
          <Field label="Department Name">
            <input required className={inputCls} placeholder="Mechanical Engineering" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
          </Field>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <div className="flex justify-end">
            <PrimaryButton type="submit">Create Department</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
