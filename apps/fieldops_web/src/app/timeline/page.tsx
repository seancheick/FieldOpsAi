"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { TimelineEvent } from "@/lib/types";

const EVENT_ICONS: Record<string, string> = {
  clock_event: "🕐",
  photo_event: "📸",
  task_event: "✅",
  note_event: "📝",
  ot_approval_event: "⏰",
  correction_event: "✏️",
};

const EVENT_LABELS: Record<string, string> = {
  clock_event: "Clock Event",
  photo_event: "Photo Uploaded",
  task_event: "Task Update",
  note_event: "Note Added",
  ot_approval_event: "OT Decision",
  correction_event: "Correction",
};

export default function TimelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Loading timeline...
        </div>
      }
    >
      <TimelineContent />
    </Suspense>
  );
}

function TimelineContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!jobId) {
      setError("no_job");
      setLoading(false);
      return;
    }

    // Fetch job name
    const { data: job } = await getSupabase()
      .from("jobs")
      .select("name")
      .eq("id", jobId)
      .maybeSingle();

    if (job) setJobName(job.name);

    // Fetch timeline events from the union view
    const { data, error: err } = await getSupabase()
      .from("job_timeline")
      .select("*")
      .eq("job_id", jobId)
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (err) {
      setError(err.message);
    } else {
      setEvents(data ?? []);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    loadTimeline();

    const supabase = getSupabase();
    const channel = supabase
      .channel(`timeline-job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "clock_events",
          filter: `job_id=eq.${jobId}`,
        },
        () => loadTimeline()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photo_events",
          filter: `job_id=eq.${jobId}`,
        },
        () => loadTimeline()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, loadTimeline]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function renderPayload(event: TimelineEvent) {
    const p = event.payload;

    switch (event.event_type) {
      case "clock_event": {
        const subtype = (p.subtype as string) ?? "unknown";
        const gpsLat = p.gps_lat as number | null;
        const gpsLng = p.gps_lng as number | null;
        const label = subtype === "clock_in" ? "Clocked In" : "Clocked Out";
        return (
          <div>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                subtype === "clock_in"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {label}
            </span>
            {gpsLat != null && gpsLng != null && (
              <span className="ml-2 text-xs text-slate-500">
                GPS: {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}
              </span>
            )}
          </div>
        );
      }
      case "photo_event":
        return (
          <span className="text-sm text-slate-600">
            Photo proof captured
            {p.is_checkpoint ? " (checkpoint)" : ""}
          </span>
        );
      case "task_event":
        return (
          <span className="text-sm text-slate-600">
            {String(p.from_status ?? "—")} → {String(p.to_status ?? "—")}
            {p.note ? `: ${String(p.note)}` : ""}
          </span>
        );
      default:
        return (
          <span className="text-xs text-slate-400">
            {JSON.stringify(p).substring(0, 120)}
          </span>
        );
    }
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
        <h2 className="text-2xl font-bold text-slate-900">
          {jobName ? `Timeline: ${jobName}` : "Job Timeline"}
        </h2>
        <p className="mt-1 text-slate-600">
          Chronological view of all worker events for this job.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Loading timeline...
        </div>
      )}

      {error === "no_job" && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-slate-500">
            Select a job from the dashboard to view its timeline.
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Go to Dashboard
          </a>
        </div>
      )}

      {error && error !== "no_job" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
          No events recorded yet for this job.
        </div>
      )}

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg">
              {EVENT_ICONS[event.event_type] ?? "📋"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {EVENT_LABELS[event.event_type] ?? event.event_type}
                </span>
                <span className="text-xs text-slate-400">
                  {formatTime(event.occurred_at)}
                </span>
              </div>
              <div className="mt-1">{renderPayload(event)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
