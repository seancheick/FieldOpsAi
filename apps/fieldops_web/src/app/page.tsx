"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Settings,
  BarChart3,
  ShieldCheck,
  Clock,
  CalendarDays,
  FileText,
  CalendarOff,
  Receipt,
  CreditCard,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-role";
import { getSupabase } from "@/lib/supabase";
import { SkeletonCard } from "@/components/ui/skeleton";
import { DailyHuddle } from "@/components/daily-huddle";
import type { JobSummary } from "@/lib/types";

interface DashboardStats {
  totalJobs: number;
  activeWorkers: number;
  photosToday: number;
  pendingOT: number;
}

interface ActiveWorker {
  id: string;
  full_name: string;
  status: "working" | "break";
  hours: number;
}

interface JobTaskCount {
  job_id: string;
  total: number;
  completed: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: React.ElementType }[]> = {
  admin: [
    { label: "dashboard.manageStaff", href: "/settings/staff", icon: Users },
    { label: "dashboard.companySettings", href: "/settings", icon: Settings },
    { label: "dashboard.viewReports", href: "/reports", icon: BarChart3 },
    { label: "dashboard.auditLog", href: "/admin", icon: ShieldCheck },
  ],
  supervisor: [
    { label: "dashboard.approveOt", href: "/overtime", icon: Clock },
    { label: "dashboard.scheduleWorkers", href: "/schedule", icon: CalendarDays },
    { label: "dashboard.viewReports", href: "/reports", icon: BarChart3 },
    { label: "dashboard.approvePto", href: "/pto", icon: CalendarOff },
  ],
  worker: [
    { label: "dashboard.mySchedule", href: "/schedule", icon: CalendarDays },
    { label: "dashboard.submitExpense", href: "/expenses", icon: Receipt },
    { label: "dashboard.requestPto", href: "/pto", icon: FileText },
    { label: "dashboard.myTimecards", href: "/timecards", icon: CreditCard },
  ],
};
QUICK_ACTIONS.foreman = QUICK_ACTIONS.worker;

export default function DashboardPage() {
  const { t } = useI18n();
  const { role, companyId } = useCurrentUser();
  const JOBS_PAGE_SIZE = 20;

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeWorkers: 0,
    photosToday: 0,
    pendingOT: 0,
  });
  const [activeWorkersList, setActiveWorkersList] = useState<ActiveWorker[]>([]);
  const [jobTasks, setJobTasks] = useState<JobTaskCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const [loadingMoreJobs, setLoadingMoreJobs] = useState(false);

  const aiHints = useMemo(() => {
    const hints: string[] = [];
    if (stats.pendingOT > 0)
      hints.push(t("dashboard.pendingOtHint", { count: stats.pendingOT }));
    const otWorkers = activeWorkersList.filter((w) => w.hours > 7);
    if (otWorkers.length > 0)
      hints.push(t("dashboard.otThresholdHint", { count: otWorkers.length }));
    if (stats.photosToday === 0 && stats.activeWorkers > 0)
      hints.push(t("dashboard.noPhotosHint"));
    return hints;
  }, [stats, activeWorkersList, t]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc(
        "get_dashboard_overview",
        { p_job_limit: JOBS_PAGE_SIZE },
      );

      if (rpcError) throw rpcError;

      const payload = (data ?? {}) as {
        stats?: Partial<DashboardStats>;
        jobs?: JobSummary[];
        activeWorkers?: Array<{
          user_id: string;
          full_name: string | null;
          status: "working" | "break";
          first_clock_in_at: string | null;
        }>;
        jobTaskCounts?: JobTaskCount[];
      };

      const jobsList = payload.jobs ?? [];
      setJobs(jobsList);
      setHasMoreJobs(jobsList.length === JOBS_PAGE_SIZE);
      setStats({
        totalJobs: payload.stats?.totalJobs ?? 0,
        activeWorkers: payload.stats?.activeWorkers ?? 0,
        photosToday: payload.stats?.photosToday ?? 0,
        pendingOT: payload.stats?.pendingOT ?? 0,
      });

      const now = Date.now();
      setActiveWorkersList(
        (payload.activeWorkers ?? []).map((w) => {
          const hours = w.first_clock_in_at
            ? Math.round((now - new Date(w.first_clock_in_at).getTime()) / 360000) / 10
            : 0;
          return {
            id: w.user_id,
            full_name: w.full_name ?? "?",
            status: w.status,
            hours,
          };
        }),
      );

      setJobTasks(payload.jobTaskCounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadMoreJobs = useCallback(async () => {
    setLoadingMoreJobs(true);
    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from("jobs")
        .select("id, name, code, status, site_name, geofence_radius_m")
        .in("status", ["active", "in_progress"])
        .order("created_at", { ascending: false })
        .range(jobs.length, jobs.length + JOBS_PAGE_SIZE - 1);

      if (err) throw err;
      const newJobs = (data ?? []) as JobSummary[];
      setJobs((prev) => [...prev, ...newJobs]);
      setHasMoreJobs(newJobs.length === JOBS_PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard.failedToLoad"));
    } finally {
      setLoadingMoreJobs(false);
    }
  }, [jobs.length, t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("dashboard.title")}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDashboard}
            className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-stone-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t("common.refresh")}
          </button>
          <a
            href="/reports"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {t("dashboard.generateReport")}
          </a>
        </div>
      </div>

      {/* Daily huddle (6am-10am or when missing>0) */}
      <DailyHuddle companyId={companyId ?? null} />

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

      {/* Role-Based Quick Actions */}
      {role && QUICK_ACTIONS[role] && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t("dashboard.quickActions")}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACTIONS[role].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <Icon className="h-5 w-5 flex-shrink-0 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {t(action.label)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
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

      {/* Who's Working Now */}
      {activeWorkersList.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t("dashboard.workingNow")}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeWorkersList.map((w) => (
              <div
                key={w.id}
                className="flex flex-shrink-0 flex-col items-center gap-1"
              >
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                    {getInitials(w.full_name)}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                      w.status === "working" ? "bg-green-500" : "bg-amber-400"
                    }`}
                  />
                </div>
                <span className="max-w-[4.5rem] truncate text-[11px] font-medium text-slate-700">
                  {w.full_name.split(" ")[0]}
                </span>
                <span className="text-[10px] text-slate-400">
                  {w.status === "break"
                    ? t("dashboard.onBreak")
                    : `${w.hours}h`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's flags (rule-based) */}
      {aiHints.length > 0 && (
        <div className="mb-6 rounded-xl border border-stone-200 border-l-4 border-l-amber-400 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-700">
            {t("dashboard.todaysFlags")}
          </h3>
          <ul className="space-y-1">
            {aiHints.map((hint, i) => (
              <li key={i} className="text-xs text-slate-600 dark:text-slate-300">
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6 flex gap-3">
        <a
          href="/map"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
        >
          {t("dashboard.openLiveMap")} →
        </a>
        <a
          href="/workers"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
        >
          {t("dashboard.viewWorkers")} →
        </a>
        <a
          href="/photos"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
        >
          {t("dashboard.photoFeed")} →
        </a>
      </div>

      {/* Jobs Grid */}
      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-400">{t("dashboard.noActiveJobs")}</p>
          <a
            href="/projects"
            className="mt-3 inline-block rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            {t("dashboard.createFirstJob")}
          </a>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => {
          const tc = jobTasks.find((jt) => jt.job_id === job.id);
          const pct = tc && tc.total > 0 ? Math.round((tc.completed / tc.total) * 100) : 0;
          return (
            <div
              key={job.id}
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all transition-transform hover:scale-[1.02] hover:border-stone-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{job.name}</h3>
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
                <p className="mt-3 text-xs text-slate-500">{job.site_name}</p>
              )}
              <div className="mt-3 text-[11px] text-slate-400">
                {t("dashboard.geofence", { radius: job.geofence_radius_m })}
              </div>
              {/* Task progress */}
              <div className="mt-3">
                {tc && tc.total > 0 ? (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {t("dashboard.tasksProgress", {
                        completed: tc.completed,
                        total: tc.total,
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-slate-300">
                    {t("dashboard.noTasks")}
                  </p>
                )}
              </div>
              <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <a
                  href={`/timeline?job_id=${job.id}`}
                  className="rounded-lg bg-stone-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-stone-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t("dashboard.timeline")}
                </a>
                <a
                  href={`/photos?job_id=${job.id}`}
                  className="rounded-lg bg-stone-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-stone-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t("dashboard.photos")}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {hasMoreJobs && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMoreJobs}
            disabled={loadingMoreJobs}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-stone-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {loadingMoreJobs ? t("common.loadingMore") : t("common.loadMore")}
          </button>
        </div>
      )}
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
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</div>
      <span className={`mt-1 block text-3xl font-bold tracking-tight tabular-nums ${color}`}>
        {value}
      </span>
      <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{change}</div>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}
