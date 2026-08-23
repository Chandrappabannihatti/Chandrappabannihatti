/* Recharts wrappers shared across dashboards. */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "./ui";

export const RISK_COLORS = { Low: "#10b981", Medium: "#f59e0b", High: "#f43f5e" };
const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

const axisProps = {
  tick: { fill: "#64748b", fontSize: 12 },
  axisLine: { stroke: "#e2e8f0" },
  tickLine: false,
};

export function RiskPie({ data, height = 260 }) {
  if (!data?.length) return <EmptyState title="No risk data yet" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [v, `${name} risk`]} />
        <Legend iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DeptBar({ data, height = 260 }) {
  if (!data?.length) return <EmptyState title="No department data" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={6}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="department" {...axisProps} />
        <YAxis yAxisId="sgpa" domain={[0, 10]} {...axisProps} axisLine={false} />
        <YAxis yAxisId="att" orientation="right" domain={[0, 100]} hide />
        <Tooltip cursor={{ fill: "#f1f5f9" }} />
        <Legend iconType="circle" iconSize={8} />
        <Bar yAxisId="sgpa" dataKey="avg_sgpa" name="Avg SGPA" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={26} />
        <Bar yAxisId="att" dataKey="avg_attendance" name="Avg Attendance %" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SgpaTrend({ data, height = 260 }) {
  if (!data?.length) return <EmptyState title="No results published yet" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="sgpaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="semester" {...axisProps} />
        <YAxis domain={[0, 10]} {...axisProps} axisLine={false} />
        <Tooltip />
        <Legend iconType="circle" iconSize={8} />
        <Area type="monotone" dataKey="sgpa" name="SGPA" stroke="#6366f1" strokeWidth={2.5} fill="url(#sgpaGrad)" />
        <Line type="monotone" dataKey="cgpa" name="CGPA" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SubjectAttendanceBar({ data, height = 280 }) {
  if (!data?.length) return <EmptyState title="No attendance records" hint="Ask your teacher to upload attendance." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} {...axisProps} axisLine={false} />
        <YAxis type="category" dataKey="subject_code" width={70} {...axisProps} axisLine={false} />
        <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="percentage" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((entry) => (
            <Cell
              key={entry.subject_code}
              fill={entry.percentage >= 85 ? "#10b981" : entry.percentage >= 75 ? "#0ea5e9" : entry.percentage >= 60 ? "#f59e0b" : "#f43f5e"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ImportanceBar({ data, height = 300 }) {
  if (!data?.length) return <EmptyState title="Model not trained yet" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" {...axisProps} axisLine={false} />
        <YAxis type="category" dataKey="feature" width={150} {...axisProps} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
        <Tooltip formatter={(v) => [(v * 100).toFixed(1) + "%", "Importance"]} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="importance" radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((entry, i) => (
            <Cell key={entry.feature} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function IABar({ data, height = 260 }) {
  if (!data?.length) return <EmptyState title="No IA marks yet" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="subject_code" {...axisProps} />
        <YAxis domain={[0, 50]} {...axisProps} axisLine={false} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} />
        <Legend iconType="circle" iconSize={8} />
        <Bar dataKey="ia1" name="IA 1 (50)" fill="#6366f1" radius={[5, 5, 0, 0]} barSize={18} />
        <Bar dataKey="ia2" name="IA 2 (50)" fill="#a5b4fc" radius={[5, 5, 0, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
