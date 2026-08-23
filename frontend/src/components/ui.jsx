/* Shared presentational primitives used across every page. */

export function Card({ title, subtitle, actions, children, className = "" }) {
  return (
    <section
      className={`bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
          <div>
            {title && (
              <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 pb-5 pt-2">{children}</div>
    </section>
  );
}

const ICONS = {
  students: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4m4 4a4 4 0 01-4 4",
  teachers: "M12 14l9-5-9-5-9 5 9 5zm0 0v6m-7-8v5.5c0 1.5 3 3 7 3s7-1.5 7-3V11",
  parents: "M12 4a4 4 0 110 8 4 4 0 010-8zm-7 16a7 7 0 0114 0",
  attendance: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  sgpa: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  risk: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  class: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  ia: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  upload: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4",
  report: "M9 17v-6m4 6V7m4 10V11M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
  backlogs: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  cgpa: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
};

export function StatCard({ label, value, icon = "students", tone = "indigo", hint, suffix }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${tones[tone]}`}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[icon] || ICONS.students} />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 truncate">
          {value}
          {suffix && <span className="text-sm font-semibold text-slate-400 ml-0.5">{suffix}</span>}
        </p>
        {hint && <p className="text-xs text-slate-400 mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
}

const RISK_STYLES = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  high: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function RiskBadge({ level }) {
  if (!level) return <span className="text-slate-400 text-xs">—</span>;
  const cls = RISK_STYLES[level.toLowerCase()] || "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${level === "Low" ? "bg-emerald-500" : level === "Medium" ? "bg-amber-500" : "bg-rose-500"}`} />
      {level} Risk
    </span>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <svg className="animate-spin h-5 w-5 mr-2.5 text-indigo-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", hint }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 grid place-items-center text-slate-400 mb-3">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function DataTable({ columns, rows, rowKey = "id", empty = "No records found" }) {
  if (!rows?.length) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={row[rowKey] ?? i} className="hover:bg-slate-50/70 transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={`px-5 py-3 whitespace-nowrap ${c.className || "text-slate-700"}`}>
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${width} bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200`}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition";

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function AttendanceBar({ value }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const color = pct >= 85 ? "bg-emerald-500" : pct >= 75 ? "bg-sky-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-11 text-right">{pct}%</span>
    </div>
  );
}
