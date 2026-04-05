"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";

interface Worker {
  id: string;
  full_name: string;
  role: string;
}

interface Job {
  id: string;
  name: string;
  code: string;
}

interface ScheduleEntry {
  id: string;
  worker_id: string;
  worker_name: string;
  job_id: string;
  job_name: string;
  job_code?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status: "draft" | "published";
  published_at?: string | null;
  published_by?: string | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SchedulePage() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split("T")[0];
  });
  const [selectedWorker, setSelectedWorker] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadReferenceData = useCallback(async () => {
    const supabase = getSupabase();
    const { data: workersData } = await supabase
      .from("users")
      .select("id, full_name, role")
      .eq("is_active", true)
      .in("role", ["worker", "foreman"])
      .order("full_name");

    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, name, code")
      .in("status", ["active", "in_progress"])
      .order("name");

    setWorkers(workersData ?? []);
    setJobs(jobsData ?? []);
  }, []);

  const loadSchedule = useCallback(async () => {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error("Missing session");
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/schedule?week_start=${weekStart}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || t("schedulePage.failedToLoad"));
    }

    setEntries((payload.shifts as ScheduleEntry[]) ?? []);
  }, [weekStart, t]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadReferenceData(), loadSchedule()]);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t("schedulePage.failedToLoad"));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [loadReferenceData, loadSchedule, t]);

  function getWeekDates() {
    const start = new Date(`${weekStart}T00:00:00`);
    return DAYS.map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  async function postSchedule(body: Record<string, unknown>) {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error("Missing session");
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/schedule`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || t("schedulePage.failedToLoad"));
    }

    return payload;
  }

  async function addEntry() {
    if (!selectedWorker || !selectedJob || !selectedDay) return;

    setBusyAction("create");
    setError(null);
    setSuccessMessage(null);
    try {
      await postSchedule({
        action: "create",
        worker_id: selectedWorker,
        job_id: selectedJob,
        shift_date: selectedDay,
        start_time: "07:00",
        end_time: "15:30",
      });
      await loadSchedule();
      setShowAddForm(false);
      setSelectedWorker("");
      setSelectedJob("");
      setSelectedDay("");
      setSuccessMessage(t("schedulePage.draftSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedulePage.failedToAdd"));
    } finally {
      setBusyAction(null);
    }
  }

  async function removeEntry(id: string) {
    setBusyAction(id);
    setError(null);
    setSuccessMessage(null);
    try {
      await postSchedule({ action: "delete", shift_id: id });
      await loadSchedule();
      setSuccessMessage(t("schedulePage.draftRemoved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedulePage.failedToRemove"));
    } finally {
      setBusyAction(null);
    }
  }

  async function publishSchedule() {
    const draftIds = entries
      .filter((entry) => entry.status === "draft")
      .map((entry) => entry.id);

    if (draftIds.length === 0) return;

    setBusyAction("publish");
    setError(null);
    setSuccessMessage(null);
    try {
      await postSchedule({
        action: "publish",
        shift_ids: draftIds,
      });
      await loadSchedule();
      setSuccessMessage(t("schedulePage.published"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedulePage.failedToPublish"));
    } finally {
      setBusyAction(null);
    }
  }

  const weekDates = getWeekDates();
  const draftCount = entries.filter((entry) => entry.status === "draft").length;
  const isDraft = draftCount > 0;

  return (
    <div>
      <div className="mb-6">
        <a
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("schedulePage.title")}</h2>
            <p className="mt-1 text-slate-600">{t("schedulePage.subtitle")}</p>
          </div>
          <div className="flex gap-3">
            {isDraft && entries.length > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {t("schedulePage.draftShifts", {
                  count: draftCount,
                  suffix: draftCount !== 1 ? "s" : "",
                })}
              </span>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              + {t("schedulePage.addShift")}
            </button>
            {isDraft && entries.length > 0 && (
              <button
                onClick={publishSchedule}
                disabled={busyAction === "publish"}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {busyAction === "publish" ? t("schedulePage.publishing") : t("schedulePage.publishSchedule")}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => {
            const d = new Date(`${weekStart}T00:00:00`);
            d.setDate(d.getDate() - 7);
            setWeekStart(d.toISOString().split("T")[0]);
          }}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
        >
          {t("schedulePage.prevWeek")}
        </button>
        <span className="text-sm font-semibold text-slate-900">
          {t("schedulePage.weekOf", {
            date: new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          })}
        </span>
        <button
          onClick={() => {
            const d = new Date(`${weekStart}T00:00:00`);
            d.setDate(d.getDate() + 7);
            setWeekStart(d.toISOString().split("T")[0]);
          }}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
        >
          {t("schedulePage.nextWeek")}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">{t("schedulePage.addShiftTitle")}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("schedulePage.worker")}
              </label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              >
                <option value="">{t("schedulePage.selectWorker")}</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("schedulePage.job")}
              </label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              >
                <option value="">{t("schedulePage.selectJob")}</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name} ({job.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("schedulePage.day")}
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              >
                <option value="">{t("schedulePage.selectDay")}</option>
                {weekDates.map((date, index) => (
                  <option key={date} value={date}>
                    {t(`schedulePage.days.${DAYS[index].toLowerCase()}`)} —{" "}
                    {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={addEntry}
              disabled={
                busyAction === "create" || !selectedWorker || !selectedJob || !selectedDay
              }
              className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {busyAction === "create" ? t("schedulePage.adding") : t("schedulePage.addShift")}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-stone-100"
            >
              {t("schedulePage.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b bg-stone-50">
          {DAYS.map((day, index) => (
            <div
              key={day}
              className="border-r px-3 py-3 text-center text-xs font-semibold text-slate-500 last:border-r-0"
            >
              {t(`schedulePage.days.${day.toLowerCase()}`)}
              <br />
              <span className="text-slate-400">
                {new Date(`${weekDates[index]}T12:00:00`).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" },
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="grid min-h-[300px] grid-cols-7">
          {weekDates.map((date) => {
            const dayEntries = entries.filter((entry) => entry.date === date);
            return (
              <div key={date} className="border-r p-2 last:border-r-0">
                {loading && dayEntries.length === 0 && (
                  <div className="flex h-20 items-center justify-center text-xs text-slate-300">
                    {t("common.loading")}
                  </div>
                )}
                {!loading && dayEntries.length === 0 && (
                  <div className="flex h-20 items-center justify-center text-xs text-slate-300">
                    {t("schedulePage.noShifts")}
                  </div>
                )}
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`mb-1 rounded-lg p-2 text-xs ${
                      entry.status === "draft"
                        ? "border border-dashed border-amber-300 bg-amber-50 text-amber-800"
                        : "bg-green-50 text-green-800"
                    }`}
                  >
                    <div className="font-semibold">{entry.worker_name}</div>
                    <div className="text-[10px] opacity-75">{entry.job_name}</div>
                    <div className="text-[10px] opacity-60">
                      {entry.start_time}–{entry.end_time}
                    </div>
                    {entry.status === "draft" && (
                      <button
                        onClick={() => removeEntry(entry.id)}
                        disabled={busyAction === entry.id}
                        className="mt-1 text-[10px] font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {busyAction === entry.id ? t("schedulePage.removing") : t("schedulePage.remove")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {!isDraft && entries.length > 0 && (
        <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
          ✓ {t("schedulePage.published")}
        </div>
      )}
    </div>
  );
}
