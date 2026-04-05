"use client";

import { ReportCharts } from "./ReportCharts";

export function JobReportView({
  report,
  t,
}: {
  report: Record<string, unknown>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const job = report.job as Record<string, string>;
  const summary = report.summary as Record<string, number>;
  const workerHours = report.worker_hours as Array<Record<string, unknown>>;
  const tasks = report.tasks as Array<Record<string, unknown>>;
  const photos = report.photos as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      {/* Job header */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {job.name}
            </h3>
            <p className="text-sm text-slate-500">
              {job.code} &middot; {job.status} &middot; {job.site_name || t("reports.noSite")}
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {t("reports.generated", {
              time: new Date(report.generated_at as string).toLocaleString(),
            })}
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: t("reports.clockEvents"), value: summary.total_clock_events },
          { label: t("reports.photos"), value: summary.total_photos },
          { label: t("reports.tasks"), value: `${summary.completed_tasks}/${summary.total_tasks}` },
          { label: t("reports.otDecisions"), value: summary.total_ot_decisions },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-stone-200 bg-white p-4 text-center"
          >
            <div className="text-2xl font-bold text-slate-900">
              {stat.value}
            </div>
            <div className="text-xs text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Visual Charts */}
      <ReportCharts
        workerHours={workerHours}
        tasks={tasks}
        summary={summary}
        t={t}
      />

      {/* Worker hours table */}
      {workerHours && workerHours.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 font-bold text-slate-900">{t("reports.workerHours")}</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2">{t("reports.worker")}</th>
                <th className="pb-2">{t("reports.sessions")}</th>
                <th className="pb-2">{t("reports.regular")}</th>
                <th className="pb-2">{t("reports.ot")}</th>
                <th className="pb-2">{t("reports.total")}</th>
              </tr>
            </thead>
            <tbody>
              {workerHours.map((wh) => (
                <tr key={wh.worker as string} className="border-b border-stone-100">
                  <td className="py-2 font-medium text-slate-900">
                    {wh.worker as string}
                  </td>
                  <td className="py-2">{wh.sessions as number}</td>
                  <td className="py-2">{wh.regular_hours as number}h</td>
                  <td className="py-2 text-amber-600">
                    {wh.ot_hours as number}h
                  </td>
                  <td className="py-2 font-semibold">
                    {wh.total_hours as number}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tasks */}
      {tasks && tasks.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 font-bold text-slate-900">{t("reports.tasks")}</h4>
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      task.status === "completed"
                        ? "bg-green-500"
                        : task.status === "in_progress"
                          ? "bg-amber-500"
                          : "bg-stone-300"
                    }`}
                  />
                  <span className="text-sm text-slate-900">
                    {task.name as string}
                  </span>
                  {(task.requires_photo as boolean) && (
                    <span className="text-xs text-amber-600">📷</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {task.status as string}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {photos && photos.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 font-bold text-slate-900">
            {t("reports.photoProof", { count: photos.length })}
          </h4>
          <div className="space-y-2">
            {photos.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2 text-sm"
              >
                <span className="text-slate-600">
                  {new Date(p.occurred_at as string).toLocaleString()}
                  {(p.is_checkpoint as boolean) && ` ${t("reports.checkpoint")}`}
                </span>
                {(p.verification_code as string | null) && (
                  <code className="rounded bg-slate-200 px-2 py-0.5 text-xs font-mono text-slate-700">
                    {p.verification_code as string}
                  </code>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
