"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
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

const TIMELINE_SOURCE_TABLES = [
  "clock_events",
  "photo_events",
  "task_events",
  "note_events",
  "ot_approval_events",
  "correction_events",
] as const;

export default function TimelinePage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          {t("timeline.loading")}
        </div>
      }
    >
      <TimelineContent />
    </Suspense>
  );
}

function TimelineContent() {
  const { t } = useI18n();
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
    if (!jobId) {
      setLoading(false);
      setError("no_job");
      return;
    }

    loadTimeline();

    const supabase = getSupabase();
    let channel = supabase.channel(`timeline-job-${jobId}`);

    for (const table of TIMELINE_SOURCE_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `job_id=eq.${jobId}`,
        },
        () => loadTimeline()
      );
    }

    channel.subscribe();

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
        const label = subtype === "clock_in" ? t("timeline.clockedIn") : t("timeline.clockedOut");
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
                {t("timeline.gps", { lat: gpsLat.toFixed(4), lng: gpsLng.toFixed(4) })}
              </span>
            )}
          </div>
        );
      }
      case "photo_event":
        return (
          <span className="text-sm text-slate-600">
            {t("timeline.photoCaptured")}
            {p.is_checkpoint ? t("timeline.checkpoint") : ""}
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
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <h2 className="text-2xl font-bold text-slate-900">
          {jobName ? t("timeline.titleWithJob", { jobName }) : t("timeline.title")}
        </h2>
        <p className="mt-1 text-slate-600">
          {t("timeline.subtitle")}
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          {t("timeline.loading")}
        </div>
      )}

      {error === "no_job" && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-slate-500">
            {t("timeline.noJob")}
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            {t("timeline.goToDashboard")}
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
          {t("common.noData")}
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
                  {{
                    clock_event: t("timeline.clockEvent"),
                    photo_event: t("timeline.photoEvent"),
                    task_event: t("timeline.taskEvent"),
                    note_event: t("timeline.noteEvent"),
                    ot_approval_event: t("timeline.otApprovalEvent"),
                    correction_event: t("timeline.correctionEvent"),
                  }[event.event_type] ?? event.event_type}
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
