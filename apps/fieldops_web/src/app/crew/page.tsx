"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Coffee, AlertCircle, Circle, Camera, RefreshCw } from "lucide-react";
import { useCurrentUser } from "@/lib/use-role";
import { isSupervisorOrAbove } from "@/lib/roles";
import { callFunctionJson } from "@/lib/function-client";
import { useI18n } from "@/lib/i18n";
import { SkeletonTable } from "@/components/ui/skeleton";

type AttendanceStatus = "clocked_in" | "on_break" | "late" | "absent";

interface CrewMember {
  worker_id: string;
  worker_name: string;
  status: AttendanceStatus;
  job_name: string | null;
  clocked_in_at: string | null;
  avatar_url: string | null;
}

interface CrewResponse {
  crew: CrewMember[];
}

type StatusFilter = "all" | AttendanceStatus;

const STATUS_ORDER: AttendanceStatus[] = [
  "clocked_in",
  "on_break",
  "late",
  "absent",
];

const STATUS_STYLE: Record<
  AttendanceStatus,
  { pill: string; dot: string; iconTint: string }
> = {
  clocked_in: {
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    iconTint: "text-emerald-500",
  },
  on_break: {
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-400",
    iconTint: "text-amber-500",
  },
  late: {
    pill: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    dot: "bg-rose-500",
    iconTint: "text-rose-500",
  },
  absent: {
    pill: "bg-stone-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    dot: "bg-slate-400",
    iconTint: "text-slate-400",
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function elapsedLabel(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function CrewPage() {
  const { t } = useI18n();
  const currentUser = useCurrentUser();
  const authorized = isSupervisorOrAbove(currentUser.role);

  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await callFunctionJson<CrewResponse>("crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attendance" }),
      });
      setCrew(res.crew ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load crew");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser.loading) return;
    if (!authorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load();
  }, [authorized, currentUser.loading, load]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: crew.length,
      clocked_in: 0,
      on_break: 0,
      late: 0,
      absent: 0,
    };
    for (const m of crew) c[m.status]++;
    return c;
  }, [crew]);

  const filtered = useMemo(() => {
    const rows = filter === "all" ? crew : crew.filter((m) => m.status === filter);
    return rows.sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      return a.worker_name.localeCompare(b.worker_name);
    });
  }, [crew, filter]);

  if (currentUser.loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
        {t("crew.loading")}
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("crew.noAccess")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("crew.title")}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            {t("crew.subtitle")}
          </p>
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            load();
          }}
          className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-stone-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          disabled={refreshing}
        >
          <RefreshCw
            size={14}
            className={refreshing ? "animate-spin" : undefined}
          />
          {t("common.refresh")}
        </button>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...STATUS_ORDER] as StatusFilter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-stone-100 text-slate-600 hover:bg-stone-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {t(`crew.filter.${f}`)} ·{" "}
              <span className="tabular-nums">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {loading && <SkeletonTable rows={5} />}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
          <button onClick={load} className="ml-3 font-semibold underline">
            {t("common.retry")}
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {t("crew.empty")}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-stone-100 dark:divide-slate-800">
            <thead className="bg-stone-50 dark:bg-slate-950">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <th className="px-4 py-3">{t("crew.col.worker")}</th>
                <th className="px-4 py-3">{t("crew.col.status")}</th>
                <th className="px-4 py-3">{t("crew.col.job")}</th>
                <th className="px-4 py-3 tabular-nums">{t("crew.col.onShift")}</th>
                <th className="px-4 py-3 text-right">{t("crew.col.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
              {filtered.map((m) => {
                const style = STATUS_STYLE[m.status];
                const StatusIcon =
                  m.status === "clocked_in"
                    ? Clock
                    : m.status === "on_break"
                      ? Coffee
                      : m.status === "late"
                        ? AlertCircle
                        : Circle;
                return (
                  <tr
                    key={m.worker_id}
                    className="group text-sm text-slate-700 hover:bg-stone-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white dark:bg-slate-700">
                            {getInitials(m.worker_name)}
                          </div>
                        )}
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {m.worker_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.pill}`}
                      >
                        <StatusIcon size={11} className={style.iconTint} />
                        {t(`crew.status.${m.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {m.job_name ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                      {m.status === "clocked_in" || m.status === "on_break"
                        ? elapsedLabel(m.clocked_in_at)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Link
                          href={`/timeline?user=${m.worker_id}`}
                          className="rounded-lg bg-stone-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-stone-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {t("crew.viewTimeline")}
                        </Link>
                        <Link
                          href={`/photos?user=${m.worker_id}`}
                          className="flex items-center gap-1 rounded-lg bg-stone-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-stone-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          <Camera size={10} />
                          {t("crew.viewPhotos")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
