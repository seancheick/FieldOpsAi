"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PIE_COLORS = ["#10b981", "#f59e0b", "#94a3b8"]; // completed, in_progress, not_started

export function ReportCharts({
  workerHours,
  tasks,
  summary,
  t,
}: {
  workerHours: Array<Record<string, unknown>> | null;
  tasks: Array<Record<string, unknown>> | null;
  summary: Record<string, number>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // Prepare bar chart data
  const barData = (workerHours ?? []).map((wh) => ({
    name: (wh.worker as string)?.split(" ").slice(0, 2).join(" ") ?? "",
    regular: Number(wh.regular_hours) || 0,
    ot: Number(wh.ot_hours) || 0,
  }));

  // Prepare pie chart data from tasks
  const taskCounts = { completed: 0, in_progress: 0, not_started: 0 };
  if (tasks && tasks.length > 0) {
    for (const task of tasks) {
      const s = task.status as string;
      if (s === "completed") taskCounts.completed++;
      else if (s === "in_progress") taskCounts.in_progress++;
      else taskCounts.not_started++;
    }
  } else {
    // Fallback to summary counts
    taskCounts.completed = summary.completed_tasks ?? 0;
    taskCounts.not_started = Math.max(
      0,
      (summary.total_tasks ?? 0) - (summary.completed_tasks ?? 0),
    );
  }

  const pieData = [
    { name: t("reports.completed"), value: taskCounts.completed },
    { name: t("reports.inProgress"), value: taskCounts.in_progress },
    { name: t("reports.notStarted"), value: taskCounts.not_started },
  ].filter((d) => d.value > 0);

  const hasBarData = barData.length > 0;
  const hasPieData = pieData.length > 0;

  if (!hasBarData && !hasPieData) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Task status donut / pie */}
      {hasPieData && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 font-bold text-slate-900">{t("reports.taskChart")}</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hours breakdown bar chart */}
      {hasBarData && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 font-bold text-slate-900">{t("reports.hoursChart")}</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="regular"
                name={t("reports.regularLabel")}
                stackId="hours"
                fill="#10b981"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="ot"
                name={t("reports.overtime")}
                stackId="hours"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
