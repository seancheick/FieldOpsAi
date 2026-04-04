"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

interface WorkerStatus {
  user_id: string;
  full_name: string;
  role: string;
  status: "clocked_in" | "on_break" | "clocked_out" | "no_show";
  current_job: string | null;
  clock_in_time: string | null;
  hours_today: number;
}

const STATUS_CONFIG = {
  clocked_in: { label: "Clocked In", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  on_break: { label: "On Break", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  clocked_out: { label: "Clocked Out", color: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  no_show: { label: "No Show", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const loadWorkers = useCallback(async () => {
    try {
      const supabase = getSupabase();

      // Fetch all workers
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, role, is_active")
        .eq("is_active", true)
        .in("role", ["worker", "foreman"])
        .order("full_name");

      // Fetch today's latest clock event per worker
      const today = new Date().toISOString().split("T")[0];
      const { data: clockEvents } = await supabase
        .from("clock_events")
        .select("user_id, event_subtype, occurred_at, jobs!clock_events_job_id_fkey(name)")
        .gte("occurred_at", `${today}T00:00:00Z`)
        .order("occurred_at", { ascending: false });

      // Build status map
      const statusMap = new Map<string, { subtype: string; time: string; job: string }>();
      for (const ce of clockEvents ?? []) {
        const uid = ce.user_id as string;
        if (!statusMap.has(uid)) {
          statusMap.set(uid, {
            subtype: ce.event_subtype as string,
            time: ce.occurred_at as string,
            job: (ce.jobs as unknown as { name: string } | null)?.name ?? "Unknown",
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
        const latest = statusMap.get(u.id as string);
        let status: WorkerStatus["status"] = "no_show";
        if (latest) {
          if (latest.subtype === "clock_in") status = "clocked_in";
          else if (latest.subtype === "break_start") status = "on_break";
          else if (latest.subtype === "clock_out" || latest.subtype === "break_end") status = "clocked_out";
        }

        return {
          user_id: u.id as string,
          full_name: u.full_name as string,
          role: u.role as string,
          status,
          current_job: latest?.job ?? null,
          clock_in_time: latest?.time ?? null,
          hours_today: +(hoursMap.get(u.id as string) ?? 0).toFixed(1),
        };
      });

      // Sort: clocked_in first, then on_break, then clocked_out, then no_show
      const order = { clocked_in: 0, on_break: 1, clocked_out: 2, no_show: 3 };
      result.sort((a, b) => order[a.status] - order[b.status]);

      setWorkers(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkers();
    const id = setInterval(loadWorkers, 10000);
    return () => clearInterval(id);
  }, [loadWorkers]);

  const filtered = filter === "all" ? workers : workers.filter((w) => w.status === filter);
  const counts = {
    all: workers.length,
    clocked_in: workers.filter((w) => w.status === "clocked_in").length,
    on_break: workers.filter((w) => w.status === "on_break").length,
    clocked_out: workers.filter((w) => w.status === "clocked_out").length,
    no_show: workers.filter((w) => w.status === "no_show").length,
  };

  return (
    <div>
      <div className="mb-6">
        <a href="/" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <span>&larr;</span> Back to Dashboard
        </a>
        <h2 className="text-2xl font-bold text-slate-900">Who&apos;s Working Now</h2>
        <p className="mt-1 text-slate-600">
          Real-time worker status · Auto-refreshes every 10s
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "clocked_in", "on_break", "clocked_out", "no_show"] as const).map((s) => {
          const label = s === "all" ? "All" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label;
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
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Loading workers...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
          No workers in this category.
        </div>
      )}

      {/* Worker table */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-stone-50 text-left text-slate-500">
                <th className="px-5 py-3">Worker</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Current Job</th>
                <th className="px-5 py-3">Since</th>
                <th className="px-5 py-3 text-right">Hours Today</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => {
                const cfg = STATUS_CONFIG[w.status];
                return (
                  <tr key={w.user_id} className="border-b border-stone-100 last:border-0">
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
