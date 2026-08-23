import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { inputCls, PrimaryButton } from "../components/ui";

const DEMO = [
  { role: "Admin", email: "admin@college.com", password: "Admin@123" },
  { role: "Teacher", email: "teacher@college.com", password: "Teacher@123" },
  { role: "Student", email: "student@college.com", password: "Student@123" },
  { role: "Parent", email: "parent@college.com", password: "Parent@123" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(`/${user.role}`);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (err.request
            ? "Cannot reach the server. Please wait a few seconds and try again."
            : "Login failed. Check your credentials.")
      );
    } finally {
      setLoading(false);
    }
  };

  const fill = (d) => {
    setEmail(d.email);
    setPassword(d.password);
    setError("");
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex w-[46%] relative overflow-hidden bg-slate-950 text-white flex-col justify-between p-12">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute bottom-0 -left-24 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 grid place-items-center font-extrabold shadow-lg shadow-indigo-500/40">
            CA
          </div>
          <div>
            <p className="font-bold">CAMPS</p>
            <p className="text-xs text-slate-400">Final-Year Project · CSE</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight">
            Centralized Academic Monitoring
            <span className="block bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
              & Prediction System
            </span>
          </h1>
          <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-md">
            One platform for admins, faculty, students and parents — attendance,
            IA marks, assignments and results fed into an XGBoost model that
            predicts academic risk before it's too late.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              ["XGBoost", "Risk engine"],
              ["3-classes", "Low·Med·High"],
              ["Excel", "Bulk uploads"],
            ].map(([t, s]) => (
              <div key={t} className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5">
                <p className="text-sm font-bold text-white">{t}</p>
                <p className="text-[11px] text-slate-400">{s}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">
          React · Flask · MySQL · XGBoost
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-100">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 p-8">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 grid place-items-center text-white font-extrabold">CA</div>
              <p className="font-bold text-slate-900">CAMPS</p>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to your portal account</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@college.com"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </label>
              {error && (
                <p className="text-sm text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <PrimaryButton type="submit" disabled={loading} className="w-full !py-2.5">
                {loading ? "Signing in..." : "Sign in"}
              </PrimaryButton>
            </form>
          </div>

          <div className="mt-4 bg-white/70 rounded-2xl ring-1 ring-slate-200 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Demo accounts — tap to fill
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.role}
                  onClick={() => fill(d)}
                  className="text-left rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-indigo-400 hover:shadow-sm transition"
                >
                  <p className="text-xs font-bold text-slate-700">{d.role}</p>
                  <p className="text-[11px] text-slate-400 truncate">{d.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
