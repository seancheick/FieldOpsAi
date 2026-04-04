"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

interface Job {
  id: string;
  name: string;
  code: string;
}

export default function ReportsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().split("T")[0],
  );
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("jobs")
      .select("id, name, code")
      .in("status", ["active", "in_progress"])
      .order("name");
    setJobs(data ?? []);
  }

  async function generateReport(reportType: string) {
    setGenerating(true);
    setError(null);
    setReportData(null);
    setCsvData(null);

    try {
      const supabase = getSupabase();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const body: Record<string, string> = { report_type: reportType };
      if (selectedJob) body.job_id = selectedJob;
      if (reportType === "timesheet") {
        body.date_from = dateFrom;
        body.date_to = dateTo;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Report generation failed");

      if (reportType === "job_report") {
        setReportData(data.report);
      } else {
        setCsvData(data.csv);
        setReportData(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  function downloadCsv() {
    if (!csvData) return;
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-8">
        <a
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> Back to Dashboard
        </a>
        <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
        <p className="mt-1 text-slate-600">
          Generate job reports and timesheet exports.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Job
            </label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} ({j.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => generateReport("job_report")}
              disabled={generating || !selectedJob}
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Job Report"}
            </button>
            <button
              onClick={() => generateReport("timesheet")}
              disabled={generating}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {generating ? "..." : "Timesheet"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* CSV Download */}
      {csvData && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-green-900">Timesheet Ready</h3>
              <p className="text-sm text-green-700">
                {(reportData as Record<string, unknown>)?.row_count as number ?? 0} rows
                from {dateFrom} to {dateTo}
              </p>
            </div>
            <button
              onClick={downloadCsv}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Download CSV
            </button>
          </div>
        </div>
      )}

      {/* Job Report Display */}
      {reportData && (reportData as Record<string, unknown>).report_type === "job_report" && (
        <JobReportView report={reportData} />
      )}
    </div>
  );
}

function JobReportView({ report }: { report: Record<string, unknown> }) {
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
              {job.code} &middot; {job.status} &middot; {job.site_name || "No site"}
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Generated {new Date(report.generated_at as string).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Clock Events", value: summary.total_clock_events },
          { label: "Photos", value: summary.total_photos },
          { label: "Tasks", value: `${summary.completed_tasks}/${summary.total_tasks}` },
          { label: "OT Decisions", value: summary.total_ot_decisions },
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

      {/* Worker hours */}
      {workerHours && workerHours.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 font-bold text-slate-900">Worker Hours</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2">Worker</th>
                <th className="pb-2">Sessions</th>
                <th className="pb-2">Regular</th>
                <th className="pb-2">OT</th>
                <th className="pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {workerHours.map((wh, i) => (
                <tr key={i} className="border-b border-stone-100">
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
          <h4 className="mb-4 font-bold text-slate-900">Tasks</h4>
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      t.status === "completed"
                        ? "bg-green-500"
                        : t.status === "in_progress"
                          ? "bg-amber-500"
                          : "bg-stone-300"
                    }`}
                  />
                  <span className="text-sm text-slate-900">
                    {t.name as string}
                  </span>
                  {(t.requires_photo as boolean) && (
                    <span className="text-xs text-amber-600">📷</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {t.status as string}
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
            Photo Proof ({photos.length})
          </h4>
          <div className="space-y-2">
            {photos.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2 text-sm"
              >
                <span className="text-slate-600">
                  {new Date(p.occurred_at as string).toLocaleString()}
                  {(p.is_checkpoint as boolean) && " (checkpoint)"}
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
