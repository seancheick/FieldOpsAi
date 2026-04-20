"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { SkeletonTable } from "@/components/ui/skeleton";

interface WorkerStatus {
  user_id: string;
  full_name: string;
  role: string;
  status: "clocked_in" | "on_break" | "clocked_out" | "no_show" | "not_scheduled";
  current_job: string | null;
  clock_in_time: string | null;
  hours_today: number;
}

const STATUS_ORDER: Record<WorkerStatus["status"], number> = {
  clocked_in: 0,
  on_break: 1,
  clocked_out: 2,
  no_show: 3,
  not_scheduled: 4,
};

export default function WorkersPage() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const loadWorkers = useCallback(async () => {
    setLoadError(null);
    try {
      const supabase = getSupabase();

      // Fetch all workers
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, role, is_active")
        .eq("is_active", true)
        .order("full_name");

      // Fetch today's latest clock event per worker
      const today = new Date().toISOString().split("T")[0];
      const [clockEventsRes, shiftsRes] = await Promise.all([
        supabase
          .from("clock_events")
          .select("user_id, event_subtype, occurred_at, jobs!clock_events_job_id_fkey(name)")
          .gte("occurred_at", `${today}T00:00:00Z`)
          .order("occurred_at", { ascending: false }),
        // Pull today's published shifts so we can distinguish no-show vs not-scheduled.
        supabase
          .from("schedule_shifts")
          .select("worker_id")
          .eq("shift_date", today)
          .eq("status", "published"),
      ]);
      const clockEvents = clockEventsRes.data;
      const scheduledToday = new Set<string>(
        (shiftsRes.data ?? []).map((s) => s.worker_id as string),
      );

      // Build status map
      const statusMap = new Map<string, { subtype: string; time: string; job: string }>();
      for (const ce of clockEvents ?? []) {
        const uid = ce.user_id as string;
        if (!statusMap.has(uid)) {
          statusMap.set(uid, {
            subtype: ce.event_subtype as string,
            time: ce.occurred_at as string,
            job: (ce.jobs as unknown as { name: string } | null)?.name ?? t("workers.unknownJob"),
          });
        }
      }

      // Count hours per worker today
      const hoursMap = new Map<string, number>();
      const sortedEvents = [...(clockEvents ?? [])].sort(
        (a, b) => new Date(a.occurred_at as string).getTime() - new Date(b.occurred_at as string).getTime(),
      );
      const openSessions = new Map<string, number>();
      for (const ce of sortedEvents) {
        const uid = ce.user_id as string;
        const time = new Date(ce.occurred_at as string).getTime();
        if (ce.event_subtype === "clock_in") {
          openSessions.set(uid, time);
        } else if (ce.event_subtype === "clock_out" && openSessions.has(uid)) {
          const start = openSessions.get(uid)!;
          hoursMap.set(uid, (hoursMap.get(uid) ?? 0) + (time - start) / 3600000);
          openSessions.delete(uid);
        }
      }
      // Add ongoing sessions
      const now = Date.now();
      for (const [uid, start] of openSessions) {
        hoursMap.set(uid, (hoursMap.get(uid) ?? 0) + (now - start) / 3600000);
      }

      const result: WorkerStatus[] = (users ?? []).map((u) => {
        const uid = u.id as string;
        const latest = statusMap.get(uid);
        // Default to "not_scheduled" (neutral) instead of "no_show" (alarming).
        // "no_show" is only for workers who had a published shift today and never clocked in.
        let status: WorkerStatus["status"] = scheduledToday.has(uid)
          ? "no_show"
          : "not_scheduled";
        if (latest) {
          if (latest.subtype === "clock_in") status = "clocked_in";
          else if (latest.subtype === "break_start") status = "on_break";
          else if (latest.subtype === "break_end") status = "clocked_in";
          else if (latest.subtype === "clock_out") status = "clocked_out";
        }

        return {
          user_id: uid,
          full_name: u.full_name as string,
          role: u.role as string,
          status,
          current_job: latest?.job ?? null,
          clock_in_time: latest?.time ?? null,
          hours_today: +(hoursMap.get(uid) ?? 0).toFixed(1),
        };
      });

      result.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

      setWorkers(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadWorkers();

    const supabase = getSupabase();
    const channel = supabase
      .channel("workers-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        () => loadWorkers()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "clock_events",
        },
        () => loadWorkers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadWorkers]);

  const STATUS_CONFIG = {
    clocked_in: { label: t("workers.clockedIn"), color: "bg-green-100 text-green-700", dot: "bg-green-500", avatarBg: "bg-green-500" },
    on_break: { label: t("workers.onBreak"), color: "bg-amber-100 text-amber-700", dot: "bg-amber-500", avatarBg: "bg-amber-500" },
    clocked_out: { label: t("workers.clockedOut"), color: "bg-blue-100 text-blue-700", dot: "bg-blue-500", avatarBg: "bg-blue-500" },
    no_show: { label: t("workers.noShow"), color: "bg-red-100 text-red-700", dot: "bg-red-500", avatarBg: "bg-red-500" },
    not_scheduled: { label: t("workers.notScheduled"), color: "bg-stone-100 text-stone-500", dot: "bg-stone-400", avatarBg: "bg-stone-400" },
  };

  const filtered = useMemo(() => {
    let list = workers;
    if (filter !== "all") list = list.filter((w) => w.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((w) => w.full_name.toLowerCase().includes(q));
    }
    if (roleFilter !== "all") list = list.filter((w) => w.role === roleFilter);

    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") {
        cmp = a.full_name.localeCompare(b.full_name);
      } else if (sortBy === "hours") {
        cmp = a.hours_today - b.hours_today;
      } else {
        cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [workers, filter, searchQuery, roleFilter, sortBy, sortDir]);

  const counts = {
    all: workers.length,
    clocked_in: workers.filter((w) => w.status === "clocked_in").length,
    on_break: workers.filter((w) => w.status === "on_break").length,
    clocked_out: workers.filter((w) => w.status === "clocked_out").length,
    no_show: workers.filter((w) => w.status === "no_show").length,
    not_scheduled: workers.filter((w) => w.status === "not_scheduled").length,
  };

  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function exportCsv() {
    const header = ["Name", "Role", "Status", "Current Job", "Clock In", "Hours Today"];
    const rows = filtered.map((w) => [
      w.full_name,
      w.role,
      w.status,
      w.current_job ?? "",
      w.clock_in_time ? new Date(w.clock_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      w.hours_today > 0 ? String(w.hours_today) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workers-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6">
        <a href="/" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("workers.title")}</h2>
            <p className="mt-1 text-slate-600">{t("workers.subtitle")}</p>
          </div>
          <button
            onClick={exportCsv}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-stone-50"
          >
            {t("workers.exportCsv")}
          </button>
        </div>
      </div>

      {/* Search and role filter */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("workers.searchPlaceholder")}
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="all">{t("workers.allRoles")}</option>
          <option value="worker">Worker</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
          <option value="foreman">Foreman</option>
        </select>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "clocked_in", "on_break", "clocked_out", "no_show", "not_scheduled"] as const).map((s) => {
          const label = s === "all" ? t("workers.all") : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label;
          const count = counts[s as keyof typeof counts];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                filter === s
                  ? "bg-amber-500 text-white"
                  : "bg-stone-100 text-slate-600 hover:bg-stone-200"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {loading && (
        <SkeletonTable rows={8} cols={5} />
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
          {t("workers.noWorkers")}
        </div>
      )}

      {/* Worker table */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-stone-50 text-left text-slate-500">
                <th className="w-10 px-3 py-3" />
                <th className="cursor-pointer select-none px-5 py-3 hover:text-slate-900" onClick={() => handleSort("name")}>
                  {t("workers.worker")} {sortBy === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="cursor-pointer select-none px-5 py-3 hover:text-slate-900" onClick={() => handleSort("status")}>
                  {t("workers.status")} {sortBy === "status" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-5 py-3">{t("workers.currentJob")}</th>
                <th className="px-5 py-3">{t("workers.since")}</th>
                <th className="cursor-pointer select-none px-5 py-3 text-right hover:text-slate-900" onClick={() => handleSort("hours")}>
                  {t("workers.hoursToday")} {sortBy === "hours" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => {
                const cfg = STATUS_CONFIG[w.status];
                return (
                  <tr key={w.user_id} className="border-b border-stone-100 last:border-0 transition-colors hover:bg-stone-50">
                    <td className="px-3 py-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${cfg.avatarBg}`}>
                        {getInitials(w.full_name)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{w.full_name}</div>
                      <div className="text-xs text-slate-400">{w.role}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {w.current_job ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {w.clock_in_time
                        ? new Date(w.clock_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">
                      {w.hours_today > 0 ? `${w.hours_today}h` : "—"}
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
