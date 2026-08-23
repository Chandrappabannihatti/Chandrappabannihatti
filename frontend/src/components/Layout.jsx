import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const ICON = (d) => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export const NAV = {
  admin: [
    { to: "/admin", label: "Dashboard", icon: ICON("M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"), end: true },
    { to: "/admin/students", label: "Students", icon: ICON("M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 014 4z") },
    { to: "/admin/teachers", label: "Teachers", icon: ICON("M12 14l9-5-9-5-9 5 9 5zm0 0v6m-7-8v5.5c0 1.5 3 3 7 3s7-1.5 7-3V11") },
    { to: "/admin/academics", label: "Academics", icon: ICON("M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253") },
    { to: "/admin/parents", label: "Parents", icon: ICON("M12 4a4 4 0 110 8 4 4 0 010-8zm-7 16a7 7 0 0114 0") },
    { to: "/admin/reports", label: "Reports", icon: ICON("M9 17v-6m4 6V7m4 10V11M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z") },
    { to: "/admin/ml-analytics", label: "ML Analytics", icon: ICON("M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z") },
  ],
  teacher: [
    { to: "/teacher", label: "Dashboard", icon: ICON("M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"), end: true },
    { to: "/teacher/upload", label: "Upload Data", icon: ICON("M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4") },
    { to: "/teacher/at-risk", label: "At-Risk Students", icon: ICON("M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z") },
  ],
  student: [
    { to: "/student", label: "Dashboard", icon: ICON("M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"), end: true },
    { to: "/student/attendance", label: "Attendance", icon: ICON("M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z") },
    { to: "/student/results", label: "Results & Marks", icon: ICON("M9 17v-6m4 6V7m4 10V11M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z") },
    { to: "/student/prediction", label: "Risk Prediction", icon: ICON("M13 10V3L4 14h7v7l9-11h-7z") },
  ],
  parent: [
    { to: "/parent", label: "Dashboard", icon: ICON("M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"), end: true },
  ],
};

const KIND_DOT = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    api.get("/auth/notifications").then(({ data }) => {
      setItems(data.notifications);
      setUnread(data.unread);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = async () => {
    setOpen(!open);
    if (!open && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      api.post("/auth/notifications/read").catch(() => {});
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-rose-500 text-[10px] font-bold text-white grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 z-40 overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
            Notifications
          </p>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {items.length === 0 && <p className="px-4 py-6 text-sm text-slate-400 text-center">No notifications</p>}
            {items.map((n) => (
              <div key={n.id} className="px-4 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${KIND_DOT[n.kind] || "bg-slate-400"}`} />
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                </div>
                <p className="text-xs text-slate-500 mt-1 ml-4">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABEL = { admin: "Administrator", teacher: "Faculty", student: "Student", parent: "Parent" };

export default function Layout() {
  const { user, logout, role } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[role] || [];

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 grid place-items-center text-white font-extrabold text-sm shadow-lg shadow-indigo-500/30">
          CA
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">CAMPS</p>
          <p className="text-[11px] text-slate-500 leading-tight">Academic Monitoring</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-800 grid place-items-center text-sm font-bold text-indigo-300">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-500">{ROLE_LABEL[role]}</p>
          </div>
          <button onClick={doLogout} title="Logout" className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64">{sidebar}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 shrink-0 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-30">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setMobileOpen(true)}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">
              Centralized Academic Monitoring & Prediction System
            </p>
            <p className="text-[11px] text-slate-400">Machine learning powered early-warning for student success</p>
          </div>
          <div className="flex-1" />
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            XGBoost model live
          </span>
          <NotificationsBell />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
