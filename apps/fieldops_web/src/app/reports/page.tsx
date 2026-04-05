"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { FileDown, Save, ChevronDown } from "lucide-react";
import { JobReportView } from "./JobReportView";

/* ---------- Types ---------- */

interface Job {
  id: string;
  name: string;
  code: string;
}

interface Preset {
  name: string;
  jobId: string;
  dateFrom: string;
  dateTo: string;
  reportType: string;
}

const PRESET_KEY = "report_presets";

function loadPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: Preset[]) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

/* ---------- Page ---------- */

export default function ReportsPage() {
  const { t } = useI18n();
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
  const [lastReportType, setLastReportType] = useState<string>("");

  // Presets state
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  useEffect(() => {
    loadJobs();
    setPresets(loadPresets());
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
    setLastReportType(reportType);

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
      if (!res.ok) throw new Error(data.message || t("reports.generationFailed"));

      if (reportType === "job_report") {
        setReportData(data.report);
      } else {
        setCsvData(data.csv);
        setReportData(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("reports.failedToGenerate"));
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

  function handleExportPdf() {
    window.print();
  }

  const handleSavePreset = useCallback(() => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    const newPreset: Preset = {
      name: trimmed,
      jobId: selectedJob,
      dateFrom,
      dateTo,
      reportType: lastReportType || "job_report",
    };
    const updated = [...presets.filter((p) => p.name !== trimmed), newPreset];
    setPresets(updated);
    savePresetsToStorage(updated);
    setPresetName("");
    setShowPresetInput(false);
  }, [presetName, selectedJob, dateFrom, dateTo, lastReportType, presets]);

  function applyPreset(preset: Preset) {
    setSelectedJob(preset.jobId);
    setDateFrom(preset.dateFrom);
    setDateTo(preset.dateTo);
    setShowPresetDropdown(false);
  }

  return (
    <div>
      <div className="mb-8">
        <a
          href="/"
          className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <h2 className="text-2xl font-bold text-slate-900">{t("reports.title")}</h2>
        <p className="mt-1 text-slate-600">{t("reports.subtitle")}</p>
      </div>

      {/* Controls */}
      <div className="no-print mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("reports.job")}
            </label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">{t("reports.allJobs")}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} ({j.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("reports.from")}
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
              {t("reports.to")}
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
              {generating ? t("reports.generating") : t("reports.jobReport")}
            </button>
            <button
              onClick={() => generateReport("timesheet")}
              disabled={generating}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {generating ? "..." : t("reports.timesheet")}
            </button>
          </div>
        </div>

        {/* Action row: Export PDF + Presets */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
          {/* Export PDF */}
          <button
            onClick={handleExportPdf}
            disabled={!reportData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 disabled:opacity-40"
          >
            <FileDown size={16} />
            {t("reports.exportPdf")}
          </button>

          {/* Save Preset */}
          {showPresetInput ? (
            <div className="inline-flex items-center gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                placeholder={t("reports.presetName")}
                className="rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                autoFocus
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => { setShowPresetInput(false); setPresetName(""); }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPresetInput(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50"
            >
              <Save size={16} />
              {t("reports.savePreset")}
            </button>
          )}

          {/* Load Preset */}
          {presets.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50"
              >
                <ChevronDown size={16} />
                {t("reports.loadPreset")}
              </button>
              {showPresetDropdown && (
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(p)}
                      className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
              <h3 className="font-bold text-green-900">{t("reports.timesheetReady")}</h3>
              <p className="text-sm text-green-700">
                {t("reports.timesheetSummary", {
                  rows: (reportData as Record<string, unknown>)?.row_count as number ?? 0,
                  from: dateFrom,
                  to: dateTo,
                })}
              </p>
            </div>
            <button
              onClick={downloadCsv}
              className="no-print rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              {t("reports.downloadCsv")}
            </button>
          </div>
        </div>
      )}

      {/* Job Report Display */}
      <div data-print-area>
        {reportData && (reportData as Record<string, unknown>).report_type === "job_report" && (
          <JobReportView report={reportData} t={t} />
        )}
      </div>
    </div>
  );
}
