"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  notes?: string | null;
  published_at?: string | null;
  published_by?: string | null;
}

type ViewMode = "day" | "week" | "twoWeek" | "month";

const DAY_LABELS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const VIEW_MODES: ViewMode[] = ["day", "week", "twoWeek", "month"];

function asDateKey(value: Date) {
  return value.toISOString().split("T")[0];
}

function startOfWeek(value: Date) {
  const copy = new Date(value);
  const day = copy.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + offset);
  return copy;
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function formatMonthDay(value: string) {
  return parseDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function buildVisibleDates(anchorKey: string, viewMode: ViewMode) {
  const anchor = parseDate(anchorKey);

  if (viewMode === "day") {
    return [anchor];
  }

  if (viewMode === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      return date;
    });
  }

  if (viewMode === "twoWeek") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      return date;
    });
  }

  const monthStart = startOfMonth(anchor);
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = startOfWeek(monthEnd);
  calendarEnd.setUTCDate(calendarEnd.getUTCDate() + 6);

  const dates: Date[] = [];
  const cursor = new Date(calendarStart);
  while (cursor <= calendarEnd) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function previousAnchor(anchorKey: string, viewMode: ViewMode) {
  const anchor = parseDate(anchorKey);
  if (viewMode === "day") anchor.setUTCDate(anchor.getUTCDate() - 1);
  if (viewMode === "week") anchor.setUTCDate(anchor.getUTCDate() - 7);
  if (viewMode === "twoWeek") anchor.setUTCDate(anchor.getUTCDate() - 14);
  if (viewMode === "month") anchor.setUTCMonth(anchor.getUTCMonth() - 1);
  return asDateKey(anchor);
}

function nextAnchor(anchorKey: string, viewMode: ViewMode) {
  const anchor = parseDate(anchorKey);
  if (viewMode === "day") anchor.setUTCDate(anchor.getUTCDate() + 1);
  if (viewMode === "week") anchor.setUTCDate(anchor.getUTCDate() + 7);
  if (viewMode === "twoWeek") anchor.setUTCDate(anchor.getUTCDate() + 14);
  if (viewMode === "month") anchor.setUTCMonth(anchor.getUTCMonth() + 1);
  return asDateKey(anchor);
}

export default function SchedulePage() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => asDateKey(startOfWeek(new Date())));
  const [formWorkerId, setFormWorkerId] = useState("");
  const [formJobId, setFormJobId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("07:00");
  const [formEndTime, setFormEndTime] = useState("15:30");
  const [formNotes, setFormNotes] = useState("");
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [draggingShiftId, setDraggingShiftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const visibleDates = useMemo(
    () => buildVisibleDates(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const rangeStart = asDateKey(visibleDates[0]);
  const rangeEnd = asDateKey(visibleDates[visibleDates.length - 1]);

  const isMonthView = viewMode === "month";
  const currentMonth = parseDate(anchorDate).getUTCMonth();

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
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/schedule?date_from=${rangeStart}&date_to=${rangeEnd}`,
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
  }, [rangeEnd, rangeStart, t]);

  // Version counter prevents stale responses from overwriting fresher ones
  // when rapid view-mode changes cause multiple loadSchedule calls in flight.
  const loadVersionRef = useRef(0);

  useEffect(() => {
    const version = ++loadVersionRef.current;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadReferenceData(), loadSchedule()]);
      } catch (err) {
        if (loadVersionRef.current === version) {
          setError(err instanceof Error ? err.message : t("schedulePage.failedToLoad"));
        }
      } finally {
        if (loadVersionRef.current === version) {
          setLoading(false);
        }
      }
    }

    loadData();
  }, [loadReferenceData, loadSchedule, t]);

  function clearForm(dateOverride?: string) {
    setEditingShiftId(null);
    setFormWorkerId("");
    setFormJobId("");
    setFormDate(dateOverride ?? "");
    setFormStartTime("07:00");
    setFormEndTime("15:30");
    setFormNotes("");
  }

  function openCreateForm(dateOverride?: string) {
    clearForm(dateOverride);
    setShowForm(true);
  }

  function openEditForm(entry: ScheduleEntry) {
    setEditingShiftId(entry.id);
    setFormWorkerId(entry.worker_id);
    setFormJobId(entry.job_id);
    setFormDate(entry.date);
    setFormStartTime(entry.start_time);
    setFormEndTime(entry.end_time);
    setFormNotes(entry.notes ?? "");
    setShowForm(true);
  }

  async function postSchedule(body: Record<string, unknown>) {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error("Missing session");
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || t("schedulePage.failedToLoad"));
    }

    return payload;
  }

  async function saveEntry() {
    if (!formWorkerId || !formJobId || !formDate || !formStartTime || !formEndTime) {
      return;
    }

    const actionKey = editingShiftId ? "update" : "create";
    const wasEditing = Boolean(editingShiftId);
    setBusyAction(actionKey);
    setError(null);
    setSuccessMessage(null);
    try {
      await postSchedule({
        action: editingShiftId ? "update" : "create",
        shift_id: editingShiftId ?? undefined,
        worker_id: formWorkerId,
        job_id: formJobId,
        shift_date: formDate,
        start_time: formStartTime,
        end_time: formEndTime,
        notes: formNotes.trim() || null,
      });
      await loadSchedule();
      clearForm();
      setShowForm(false);
      setSuccessMessage(
        wasEditing ? t("schedulePage.draftUpdated") : t("schedulePage.draftSaved"),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingShiftId
            ? t("schedulePage.failedToUpdate")
            : t("schedulePage.failedToAdd"),
      );
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

  async function updateEntry(id: string, changes: Partial<Pick<ScheduleEntry, "worker_id" | "job_id" | "date" | "start_time" | "end_time" | "notes">>) {
    setBusyAction(id);
    setError(null);
    setSuccessMessage(null);
    try {
      await postSchedule({
        action: "update",
        shift_id: id,
        worker_id: changes.worker_id,
        job_id: changes.job_id,
        shift_date: changes.date,
        start_time: changes.start_time,
        end_time: changes.end_time,
        notes: changes.notes,
      });
      await loadSchedule();
      setSuccessMessage(t("schedulePage.draftUpdated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedulePage.failedToUpdate"));
    } finally {
      setBusyAction(null);
    }
  }

  async function publishSchedule() {
    const draftIds = entries.filter((entry) => entry.status === "draft").map((entry) => entry.id);
    if (draftIds.length === 0) return;

    setBusyAction("publish");
    setError(null);
    setSuccessMessage(null);
    try {
      await postSchedule({ action: "publish", shift_ids: draftIds });
      await loadSchedule();
      setSuccessMessage(t("schedulePage.published"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedulePage.failedToPublish"));
    } finally {
      setBusyAction(null);
    }
  }

  const draftCount = entries.filter((entry) => entry.status === "draft").length;
  const isDraft = draftCount > 0;
  const publishedShifts = entries.filter((entry) => entry.status === "published");

  const gridColumns = useMemo(() => {
    if (viewMode === "day") return "1fr";
    if (viewMode === "twoWeek") return "repeat(14, minmax(180px, 1fr))";
    return "repeat(7, minmax(0, 1fr))";
  }, [viewMode]);

  const rangeLabel = useMemo(() => {
    if (viewMode === "day") {
      return parseDate(anchorDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    if (viewMode === "month") {
      return parseDate(anchorDate).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }
    return `${formatMonthDay(rangeStart)} - ${formatMonthDay(rangeEnd)}`;
  }, [anchorDate, rangeEnd, rangeStart, viewMode]);

  const gridStyle: CSSProperties = { gridTemplateColumns: gridColumns };

  return (
    <div>
      <div className="mb-6">
        <a
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("schedulePage.title")}</h2>
            <p className="mt-1 text-slate-600">{t("schedulePage.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isDraft && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {t("schedulePage.draftShifts", {
                  count: draftCount,
                  suffix: draftCount !== 1 ? "s" : "",
                })}
              </span>
            )}
            <button
              onClick={() => openCreateForm(asDateKey(visibleDates[0]))}
              className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              + {t("schedulePage.addShift")}
            </button>
            {isDraft && (
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                viewMode === mode
                  ? "bg-slate-900 text-white"
                  : "bg-stone-100 text-slate-600 hover:bg-stone-200"
              }`}
            >
              {t(`schedulePage.viewModes.${mode}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setAnchorDate((current) => previousAnchor(current, viewMode))}
            className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
          >
            {t("schedulePage.prevRange")}
          </button>
          <span className="text-sm font-semibold text-slate-900">{rangeLabel}</span>
          <button
            onClick={() => setAnchorDate((current) => nextAnchor(current, viewMode))}
            className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
          >
            {t("schedulePage.nextRange")}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">
            {editingShiftId ? t("schedulePage.editShiftTitle") : t("schedulePage.addShiftTitle")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("schedulePage.worker")}
              </label>
              <select
                value={formWorkerId}
                onChange={(event) => setFormWorkerId(event.target.value)}
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
                value={formJobId}
                onChange={(event) => setFormJobId(event.target.value)}
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
              <input
                type="date"
                value={formDate}
                onChange={(event) => setFormDate(event.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("schedulePage.startTime")}
              </label>
              <input
                type="time"
                value={formStartTime}
                onChange={(event) => setFormStartTime(event.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("schedulePage.endTime")}
              </label>
              <input
                type="time"
                value={formEndTime}
                onChange={(event) => setFormEndTime(event.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("schedulePage.notes")}
              </label>
              <textarea
                value={formNotes}
                onChange={(event) => setFormNotes(event.target.value)}
                placeholder={t("schedulePage.notesPlaceholder")}
                className="min-h-[96px] w-full rounded-xl border border-stone-300 px-4 py-3 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={saveEntry}
              disabled={
                Boolean(busyAction) || !formWorkerId || !formJobId || !formDate || !formStartTime || !formEndTime
              }
              className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {busyAction === "create" || busyAction === "update"
                ? t("schedulePage.saving")
                : editingShiftId
                  ? t("schedulePage.saveDraft")
                  : t("schedulePage.addShift")}
            </button>
            <button
                  onClick={() => {
                    clearForm();
                    setShowForm(false);
                  }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-stone-100"
            >
              {t("schedulePage.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="grid border-b bg-stone-50" style={gridStyle}>
          {visibleDates.map((date) => {
            const dateKey = asDateKey(date);
            const isDimmed = isMonthView && date.getUTCMonth() !== currentMonth;
            return (
              <div
                key={dateKey}
                className={`border-r px-3 py-3 text-center text-xs font-semibold last:border-r-0 ${
                  isDimmed ? "bg-stone-100 text-slate-300" : "text-slate-500"
                }`}
              >
                {t(`schedulePage.days.${DAY_LABELS[date.getUTCDay()]}`)}
                <br />
                <span className={isDimmed ? "text-slate-300" : "text-slate-400"}>
                  {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className={`grid ${viewMode === "month" ? "" : "min-h-[320px]"}`}
          style={gridStyle}
        >
          {visibleDates.map((date) => {
            const dateKey = asDateKey(date);
            const dayEntries = entries.filter((entry) => entry.date === dateKey);
            const isDimmed = isMonthView && date.getUTCMonth() !== currentMonth;
            return (
              <div
                key={dateKey}
                className={`border-r p-2 last:border-r-0 ${isDimmed ? "bg-stone-50" : ""}`}
                onDragOver={(event) => {
                  if (draggingShiftId) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingShiftId) {
                    void updateEntry(draggingShiftId, { date: dateKey });
                    setDraggingShiftId(null);
                  }
                }}
              >
                {loading && dayEntries.length === 0 && (
                  <div className="flex h-20 items-center justify-center text-xs text-slate-300">
                    {t("common.loading")}
                  </div>
                )}
                {!loading && dayEntries.length === 0 && (
                  <button
                    onClick={() => openCreateForm(dateKey)}
                    className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-stone-200 text-xs text-slate-300 hover:border-amber-300 hover:text-slate-500"
                  >
                    {t("schedulePage.noShifts")}
                  </button>
                )}
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    draggable={entry.status === "draft"}
                    onDragStart={() => setDraggingShiftId(entry.id)}
                    onDragEnd={() => setDraggingShiftId(null)}
                    className={`mb-1 rounded-lg p-2 text-xs ${
                      entry.status === "draft"
                        ? "cursor-move border border-dashed border-amber-300 bg-amber-50 text-amber-800"
                        : "bg-green-50 text-green-800"
                    }`}
                  >
                    <button
                      onClick={() => entry.status === "draft" && openEditForm(entry)}
                      className="w-full text-left"
                    >
                      <div className="font-semibold">{entry.worker_name}</div>
                      <div className="text-[10px] opacity-75">{entry.job_name}</div>
                      <div className="text-[10px] opacity-60">
                        {entry.start_time}–{entry.end_time}
                      </div>
                      {entry.notes && (
                        <div className="mt-1 line-clamp-2 text-[10px] opacity-80">{entry.notes}</div>
                      )}
                    </button>
                    {entry.status === "draft" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => openEditForm(entry)}
                          className="text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                        >
                          {t("schedulePage.edit")}
                        </button>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          disabled={busyAction === entry.id}
                          className="text-[10px] font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {busyAction === entry.id ? t("schedulePage.removing") : t("schedulePage.remove")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {!isDraft && publishedShifts.length > 0 && (
        <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
          ✓ {t("schedulePage.published")}
        </div>
      )}
    </div>
  );
}
