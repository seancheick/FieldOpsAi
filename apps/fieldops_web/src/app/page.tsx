"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
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

function generateSparkData(seed: number): { value: number }[] {
  const base = Math.max(1, seed - 3);
  let s = seed + 7;
  return Array.from({ length: 7 }, (_, i) => {
    s = (s * 9301 + 49297) % 233280;
    const r = (s / 233280);
    return { value: base + Math.round(r * 4 * (i / 6)) };
  });
}

function getTrend(data: { value: number }[]): "up" | "down" | "flat" {
  if (data.length < 2) return "flat";
  const last = data[data.length - 1].value;
  const first = data[0].value;
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
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
  const { role } = useCurrentUser();
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

  const sparkDataMap = useMemo(() => ({
    totalJobs: generateSparkData(stats.totalJobs),
    activeWorkers: generateSparkData(stats.activeWorkers),
    photosToday: generateSparkData(stats.photosToday),
    pendingOT: generateSparkData(stats.pendingOT),
  }), [stats.totalJobs, stats.activeWorkers, stats.photosToday, stats.pendingOT]);

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
      const today = new Date().toISOString().split("T")[0];

      const [jobsRes, clockRes, photosRes, otRes, workersRes, tasksRes] =
        await Promise.all([
          supabase
            .from("jobs")
            .select("id, name, code, status, site_name, geofence_radius_m")
            .in("status", ["active", "in_progress"])
            .order("created_at", { ascending: false })
            .limit(JOBS_PAGE_SIZE),
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
          supabase
            .from("clock_events")
            .select("user_id, event_subtype, occurred_at, users!inner(id, full_name)")
            .in("event_subtype", ["clock_in", "clock_out", "break_start", "break_end"])
            .gte("occurred_at", `${today}T00:00:00Z`)
            .order("occurred_at", { ascending: false }),
          supabase.from("tasks").select("id, status, job_id"),
        ]);

      if (jobsRes.error) throw jobsRes.error;

      setJobs(jobsRes.data ?? []);
      setHasMoreJobs((jobsRes.data ?? []).length === JOBS_PAGE_SIZE);
      setStats({
        totalJobs: (jobsRes.data ?? []).length,
        activeWorkers: clockRes.count ?? 0,
        photosToday: photosRes.count ?? 0,
        pendingOT: otRes.count ?? 0,
      });

      // Deduplicate workers by user_id (latest event wins)
      if (workersRes.data) {
        const seen = new Map<string, ActiveWorker>();
        const processed = new Set<string>();
        const firstClock = new Map<string, string>();
        for (const ev of workersRes.data) {
          const uid = ev.user_id as string;
          const user = ev.users as unknown as { id: string; full_name: string };
          if (!firstClock.has(uid)) firstClock.set(uid, ev.occurred_at as string);
          if (processed.has(uid)) continue;
          processed.add(uid);
          const sub = ev.event_subtype as string;
          // clock_out means the worker is no longer active — mark processed and skip
          if (sub === "clock_out") continue;
          const status: "working" | "break" = sub === "break_start" ? "break" : "working";
          const clockIn = firstClock.get(uid) ?? ev.occurred_at as string;
          const hours = Math.round(
            (Date.now() - new Date(clockIn).getTime()) / 3600000 * 10
          ) / 10;
          seen.set(uid, { id: uid, full_name: user?.full_name ?? "?", status, hours });
        }
        setActiveWorkersList(Array.from(seen.values()));
      }

      // Aggregate task counts per job
      if (tasksRes.data) {
        const map = new Map<string, { total: number; completed: number }>();
        for (const task of tasksRes.data) {
          const jid = task.job_id as string;
          if (!map.has(jid)) map.set(jid, { total: 0, completed: 0 });
          const entry = map.get(jid)!;
          entry.total++;
          if (task.status === "completed" || task.status === "done") entry.completed++;
        }
        setJobTasks(
          Array.from(map.entries()).map(([job_id, c]) => ({ job_id, ...c }))
        );
      }
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
          sparkData={sparkDataMap.totalJobs}
          trend={getTrend(sparkDataMap.totalJobs)}
          sparkColor="#334155"
        />
        <KPICard
          label={t("dashboard.workersClockedIn")}
          value={stats.activeWorkers.toString()}
          change={t("dashboard.today")}
          color="text-green-600"
          sparkData={sparkDataMap.activeWorkers}
          trend={getTrend(sparkDataMap.activeWorkers)}
          sparkColor="#16a34a"
        />
        <KPICard
          label={t("dashboard.photosToday")}
          value={stats.photosToday.toString()}
          change={t("dashboard.proofCaptured")}
          color="text-blue-600"
          sparkData={sparkDataMap.photosToday}
          trend={getTrend(sparkDataMap.photosToday)}
          sparkColor="#2563eb"
        />
        <KPICard
          label={t("dashboard.pendingOt")}
          value={stats.pendingOT.toString()}
          change={t("dashboard.awaitingApproval")}
          color={stats.pendingOT > 0 ? "text-amber-600" : "text-slate-400"}
          href={stats.pendingOT > 0 ? "/overtime" : undefined}
          sparkData={sparkDataMap.pendingOT}
          trend={getTrend(sparkDataMap.pendingOT)}
          sparkColor="#d97706"
        />
      </div>

      {/* Role-Based Quick Actions */}
      {role && QUICK_ACTIONS[role] && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">
            {t("dashboard.quickActions")}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACTIONS[role].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md"
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
          <h2 className="mb-3 text-sm font-semibold text-slate-600">
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

      {/* AI Insights */}
      {aiHints.length > 0 && (
        <div className="mb-6 rounded-xl border-l-4 border-indigo-400 bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-indigo-800">
            <span>&#10024;</span> {t("dashboard.aiInsights")}
          </h3>
          <ul className="space-y-1">
            {aiHints.map((hint, i) => (
              <li key={i} className="text-xs text-indigo-700">
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
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md"
        >
          {t("dashboard.openLiveMap")} →
        </a>
        <a
          href="/workers"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md"
        >
          {t("dashboard.viewWorkers")} →
        </a>
        <a
          href="/photos"
          className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all transition-transform hover:scale-[1.02] active:scale-[0.98] hover:border-slate-300 hover:shadow-md"
        >
          {t("dashboard.photoFeed")} →
        </a>
      </div>

      {/* Jobs Grid */}
      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center">
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
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all transition-transform hover:scale-[1.02] hover:border-stone-300 hover:shadow-md"
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
                <p className="mt-3 text-xs text-slate-500">{job.site_name}</p>
              )}
              <div className="mt-3 text-[11px] text-slate-400">
                {t("dashboard.geofence", { radius: job.geofence_radius_m })}
              </div>
              {/* Task progress */}
              <div className="mt-3">
                {tc && tc.total > 0 ? (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
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
          );
        })}
      </div>

      {hasMoreJobs && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMoreJobs}
            disabled={loadingMoreJobs}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-stone-50 disabled:opacity-50"
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
  sparkData,
  trend,
  sparkColor = "#334155",
}: {
  label: string;
  value: string;
  change: string;
  color: string;
  href?: string;
  sparkData?: { value: number }[];
  trend?: "up" | "down" | "flat";
  sparkColor?: string;
}) {
  const arrow =
    trend === "up" ? (
      <span className="text-green-500">&#8593;</span>
    ) : trend === "down" ? (
      <span className="text-red-500">&#8595;</span>
    ) : null;

  const content = (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="flex items-center gap-2">
        <span className={`mt-1 text-3xl font-bold tracking-tight ${color}`}>
          {value}
        </span>
        {arrow}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{change}</div>
      {sparkData && sparkData.length > 0 && (
        <div className="mt-2 h-8 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor}
                fill={sparkColor}
                fillOpacity={0.1}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}
