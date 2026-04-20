"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/use-role";
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

const TIMELINE_JOB_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "in_progress",
  "review",
  "completed",
] as const;

interface JobOption {
  id: string;
  name: string;
  code: string;
  status: string;
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();

  // Accept both `?job=<id>` (new) and `?job_id=<id>` (legacy) for backwards compat.
  const jobId = searchParams.get("job") ?? searchParams.get("job_id");

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");

  // Load jobs list scoped to current company.
  useEffect(() => {
    if (currentUser.loading) return;
    if (!currentUser.companyId) {
      setJobsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setJobsLoading(true);
      setJobsError(null);
      const { data, error } = await getSupabase()
        .from("jobs")
        .select("id, name, code, status")
        .eq("company_id", currentUser.companyId)
        .is("deleted_at", null)
        .in("status", TIMELINE_JOB_STATUSES as unknown as string[])
        .order("name", { ascending: true })
        .limit(200);

      if (cancelled) return;

      if (error) {
        setJobsError(error.message);
        setJobs([]);
      } else {
        setJobs((data ?? []) as JobOption[]);
      }
      setJobsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser.loading, currentUser.companyId]);

  // Auto-pick if exactly one job and no URL selection.
  useEffect(() => {
    if (jobsLoading) return;
    if (jobId) return;
    if (jobs.length !== 1) return;
    router.replace(`/timeline?job=${jobs[0].id}`);
  }, [jobsLoading, jobs, jobId, router]);

  const handleJobChange = useCallback(
    (nextId: string) => {
      if (!nextId) {
        router.replace("/timeline");
      } else {
        router.replace(`/timeline?job=${nextId}`);
      }
    },
    [router],
  );

  const filteredJobs = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) || j.code.toLowerCase().includes(q),
    );
  }, [jobs, filterText]);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId],
  );

  // ---- Render states ---------------------------------------------------

  if (currentUser.loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
        {t("timeline.loading")}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <a
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {selectedJob
              ? t("timeline.titleWithJob", { jobName: selectedJob.name })
              : t("timeline.title")}
          </h2>
          <p className="mt-1 text-slate-600">{t("timeline.subtitle")}</p>
        </div>

        {/* Job picker */}
        {currentUser.companyId && jobs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {jobs.length > 8 && (
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter jobs…"
                  className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
            <select
              value={jobId ?? ""}
              onChange={(e) => handleJobChange(e.target.value)}
              className="min-w-[240px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">Select a job to view its timeline</option>
              {filteredJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                  {j.code ? ` (${j.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {jobsError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {jobsError}
        </div>
      )}

      {/* No company resolved */}
      {!currentUser.companyId && !currentUser.loading && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
          {t("timeline.noJob")}
        </div>
      )}

      {/* Company with zero jobs */}
      {currentUser.companyId && !jobsLoading && jobs.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-slate-500">
            No jobs in this company yet — create one from the Projects tab.
          </p>
        </div>
      )}

      {/* Jobs exist but none selected */}
      {currentUser.companyId && jobs.length > 0 && !jobId && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-slate-500">
            Select a job above to view its timeline.
          </p>
          <a
            href="/"
            className="mt-4 inline-block text-sm font-medium text-slate-500 underline hover:text-slate-900"
          >
            {t("timeline.goToDashboard")}
          </a>
        </div>
      )}

      {/* Events list for selected job */}
      {currentUser.companyId && jobId && (
        <TimelineEventsList jobId={jobId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Events list (unchanged fetching logic, extracted for readability)
// ---------------------------------------------------------------------------

interface TimelineEventsListProps {
  jobId: string;
}

function TimelineEventsList({ jobId }: TimelineEventsListProps) {
  const { t } = useI18n();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

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
        () => loadTimeline(),
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
        const label =
          subtype === "clock_in"
            ? t("timeline.clockedIn")
            : t("timeline.clockedOut");
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
                {t("timeline.gps", {
                  lat: gpsLat.toFixed(4),
                  lng: gpsLng.toFixed(4),
                })}
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
        {t("timeline.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
        {t("common.noData")}
      </div>
    );
  }

  return (
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
  );
}
