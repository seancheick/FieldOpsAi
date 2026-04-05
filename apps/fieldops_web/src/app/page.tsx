"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import type { JobSummary } from "@/lib/types";

interface DashboardStats {
  totalJobs: number;
  activeWorkers: number;
  photosToday: number;
  pendingOT: number;
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeWorkers: 0,
    photosToday: 0,
    pendingOT: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const today = new Date().toISOString().split("T")[0];

      const [jobsRes, clockRes, photosRes, otRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, name, code, status, site_name, geofence_radius_m")
          .in("status", ["active", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("clock_events")
          .select("user_id", { count: "exact", head: true })
          .eq("event_subtype", "clock_in")
          .gte("occurred_at", `${today}T00:00:00Z`),
        supabase
          .from("photo_events")
          .select("id", { count: "exact", head: true })
          .gte("occurred_at", `${today}T00:00:00Z`),
        supabase
          .from("ot_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      if (jobsRes.error) throw jobsRes.error;

      setJobs(jobsRes.data ?? []);
      setStats({
        totalJobs: (jobsRes.data ?? []).length,
        activeWorkers: clockRes.count ?? 0,
        photosToday: photosRes.count ?? 0,
        pendingOT: otRes.count ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("dashboard.title")}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDashboard}
            className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-stone-200"
          >
            {t("common.refresh")}
          </button>
          <a
            href="/reports"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            {t("dashboard.generateReport")}
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label={t("dashboard.activeJobs")}
          value={stats.totalJobs.toString()}
          change={t("dashboard.thisWeek")}
          color="text-slate-900"
        />
        <KPICard
          label={t("dashboard.workersClockedIn")}
          value={stats.activeWorkers.toString()}
          change={t("dashboard.today")}
          color="text-green-600"
        />
        <KPICard
          label={t("dashboard.photosToday")}
          value={stats.photosToday.toString()}
          change={t("dashboard.proofCaptured")}
          color="text-blue-600"
        />
        <KPICard
          label={t("dashboard.pendingOt")}
          value={stats.pendingOT.toString()}
          change={t("dashboard.awaitingApproval")}
          color={stats.pendingOT > 0 ? "text-amber-600" : "text-slate-400"}
          href={stats.pendingOT > 0 ? "/overtime" : undefined}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-slate-900" />
          {t("common.loading")}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
          <button
            onClick={loadDashboard}
            className="ml-3 font-semibold underline"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6 flex gap-3">
        <a
          href="/map"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
        >
          {t("dashboard.openLiveMap")} →
        </a>
        <a
          href="/workers"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
        >
          {t("dashboard.viewWorkers")} →
        </a>
        <a
          href="/photos"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
        >
          {t("dashboard.photoFeed")} →
        </a>
      </div>

      {/* Jobs Grid */}
      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">{t("dashboard.noActiveJobs")}</p>
          <a
            href="/onboarding"
            className="mt-3 inline-block rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            {t("dashboard.createFirstJob")}
          </a>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900">{job.name}</h3>
                <p className="text-xs text-slate-400">{job.code}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  job.status === "in_progress"
                    ? "bg-green-50 text-green-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                {job.status.replace("_", " ")}
              </span>
            </div>
            {job.site_name && (
              <p className="mt-3 text-xs text-slate-500">
                {job.site_name}
              </p>
            )}
            <div className="mt-3 text-[11px] text-slate-400">
              {t("dashboard.geofence", { radius: job.geofence_radius_m })}
            </div>
            <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <a
                href={`/timeline?job_id=${job.id}`}
                className="rounded-lg bg-stone-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-stone-100"
              >
                {t("dashboard.timeline")}
              </a>
              <a
                href={`/photos?job_id=${job.id}`}
                className="rounded-lg bg-stone-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-stone-100"
              >
                {t("dashboard.photos")}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  change,
  color,
  href,
}: {
  label: string;
  value: string;
  change: string;
  color: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold tracking-tight ${color}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{change}</div>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}
