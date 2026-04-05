"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import {
  DndContext,
  useDraggable,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Worker {
  id: string;
  full_name: string;
  role: string;
  metadata?: {
    hourly_rate?: number;
  };
}

interface PtoRequest {
  id: string;
  user_id: string;
  status: string;
  start_date: string;
  end_date: string;
}

function DraggableWorker({
  worker,
  isOverlappingPTO,
  currentHours,
}: {
  worker: Worker;
  isOverlappingPTO: boolean;
  currentHours: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: worker.id,
    data: { worker },
  });

  let statusColor = "bg-green-500";
  let statusGlow = "shadow-[0_0_8px_rgba(34,197,94,0.4)]";
  if (isOverlappingPTO) {
    statusColor = "bg-red-500";
    statusGlow = "shadow-[0_0_8px_rgba(239,68,68,0.4)]";
  } else if (currentHours >= 40) {
    statusColor = "bg-amber-500";
    statusGlow = "shadow-[0_0_8px_rgba(245,158,11,0.4)]";
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`relative cursor-grab rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-opacity hover:border-slate-300 ${isDragging ? "opacity-40" : "opacity-100"}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">{worker.full_name}</div>
        <div
          className={`h-3 w-3 rounded-full ${statusColor} ${statusGlow}`}
          title={
            isOverlappingPTO
              ? "On PTO"
              : currentHours >= 40
                ? "Overtime Risk"
                : "Available"
          }
        />
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{worker.role}</span>
          <span className={`font-semibold tabular-nums ${currentHours >= 40 ? "text-red-600" : currentHours >= 32 ? "text-amber-600" : "text-slate-600"}`}>
            {currentHours}h / 40h
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${currentHours >= 40 ? "bg-red-500" : currentHours >= 32 ? "bg-amber-400" : "bg-green-400"}`}
            style={{ width: `${Math.min((currentHours / 40) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
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
  status: "draft" | "published" | "ghost";
  notes?: string | null;
  published_at?: string | null;
  published_by?: string | null;
}

type ViewMode = "day" | "week" | "twoWeek" | "month";

interface ScheduleTemplate {
  name: string;
  createdAt: string;
  shifts: Array<{
    worker_id: string;
    job_id: string;
    day_offset: number;
    start_time: string;
    end_time: string;
    notes: string;
  }>;
}

function loadTemplates(): ScheduleTemplate[] {
  try {
    return JSON.parse(localStorage.getItem("schedule_templates") ?? "[]");
  } catch {
    return [];
  }
}

function persistTemplates(templates: ScheduleTemplate[]) {
  localStorage.setItem("schedule_templates", JSON.stringify(templates));
}

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
  const monthEnd = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  );
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

function formatTime(value: string) {
  return value.length === 5 ? value : "07:00";
}

function buildEventDateTime(date: string, time: string) {
  return `${date}T${time}:00Z`;
}

interface ConflictContext {
  type: "pto" | "overtime" | "overbook";
  title: string;
  message: string;
  costImpact?: number;
}

export default function SchedulePage() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [ptoRequests, setPtoRequests] = useState<PtoRequest[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() =>
    asDateKey(startOfWeek(new Date())),
  );
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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);
  
  // Conflict Detection State
  const [conflictContext, setConflictContext] = useState<ConflictContext | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // AI Smart Fill State
  const [ghostShifts, setGhostShifts] = useState<ScheduleEntry[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [reviewGhostShift, setReviewGhostShift] = useState<ScheduleEntry | null>(null);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>(() => loadTemplates());
  const [showTemplateInput, setShowTemplateInput] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [showApplyDropdown, setShowApplyDropdown] = useState(false);

  const visibleDates = useMemo(
    () => buildVisibleDates(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const rangeStart = asDateKey(visibleDates[0]);
  const rangeEnd = asDateKey(visibleDates[visibleDates.length - 1]);

  const isMonthView = viewMode === "month";
  const currentMonth = parseDate(anchorDate).getUTCMonth();

  const filteredWorkers = useMemo(() => {
    if (!searchText.trim()) return workers;
    return workers.filter((worker) =>
      worker.full_name.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [searchText, workers]);

  const events = useMemo(
    () =>
      [...entries, ...ghostShifts].map((entry) => ({
        id: entry.id,
        resourceId: entry.job_id,
        title: entry.worker_name || workers.find((w) => w.id === entry.worker_id)?.full_name || "Unknown",
        start: buildEventDateTime(entry.date, formatTime(entry.start_time)),
        end: buildEventDateTime(entry.date, formatTime(entry.end_time)),
        backgroundColor: entry.status === "draft" ? "#f8e2b4" : entry.status === "ghost" ? "#e0e7ff" : "#dcfce7",
        borderColor: entry.status === "draft" ? "#f59e0b" : entry.status === "ghost" ? "#8b5cf6" : "#4ade80",
        textColor: entry.status === "draft" ? "#92400e" : entry.status === "ghost" ? "#4c1d95" : "#166534",
        extendedProps: {
          isGhost: entry.status === "ghost",
          status: entry.status,
          worker_name: entry.worker_name,
          job_id: entry.job_id,
          worker_id: entry.worker_id,
          notes: entry.notes,
        },
      })),
    [entries, ghostShifts, workers],
  );

  const resources = useMemo(
    () =>
      jobs.map((job) => ({ id: job.id, title: `${job.name} (${job.code})` })),
    [jobs],
  );

  const loadReferenceData = useCallback(async () => {
    const supabase = getSupabase();
    const { data: workersData } = await supabase
      .from("users")
      .select("id, full_name, role, metadata")
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
    setPtoRequests((payload.pto_requests as PtoRequest[]) ?? []);
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
          setError(
            err instanceof Error ? err.message : t("schedulePage.failedToLoad"),
          );
        }
      } finally {
        if (loadVersionRef.current === version) {
          setLoading(false);
        }
      }
    }

    loadData();
  }, [loadReferenceData, loadSchedule, t]);

  function addDays(value: string, amount: number) {
    const date = parseDate(value);
    date.setUTCDate(date.getUTCDate() + amount);
    return asDateKey(date);
  }

  const calendarView = useMemo(() => {
    if (viewMode === "day") return "resourceTimelineDay";
    if (viewMode === "week") return "resourceTimelineWeek";
    if (viewMode === "twoWeek") return "resourceTimelineWeek";
    return "resourceTimelineMonth";
  }, [viewMode]);

  const currentSlotDuration = useMemo(() => {
    if (viewMode === "month" || viewMode === "twoWeek") return "24:00:00";
    if (viewMode === "day") return "00:30:00";
    return "01:00:00"; // week view
  }, [viewMode]);

  useEffect(() => {
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      api.changeView(calendarView);
      api.setOption("slotDuration", currentSlotDuration);
    }
  }, [calendarView, currentSlotDuration]);

  const visibleRange = useMemo(
    () => ({ start: rangeStart, end: addDays(rangeEnd, 1) }),
    [rangeEnd, rangeStart],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveWorker((event.active.data.current?.worker as Worker) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveWorker(null);
    const { active } = event;
    if (event.activatorEvent) {
      const ev = event.activatorEvent as MouseEvent | TouchEvent;
      const clientX =
        "clientX" in ev ? ev.clientX : ev.changedTouches?.[0]?.clientX;
      const clientY =
        "clientY" in ev ? ev.clientY : ev.changedTouches?.[0]?.clientY;
      if (clientX === undefined || clientY === undefined) return;

      const elements = document.elementsFromPoint(clientX, clientY);

      const resourceEl = elements.find((el) =>
        el.closest("tr[data-resource-id]"),
      );

      // In FullCalendar's resource-timeline, the vertical date columns are explicitly defined in the header.
      const dateHeaders = Array.from(document.querySelectorAll("th[data-date], td[data-date]"));
      const matchedHeader = dateHeaders.find((el) => {
        const rect = el.getBoundingClientRect();
        return clientX >= rect.left && clientX <= rect.right;
      });

      if (matchedHeader && resourceEl) {
        const dateStr = matchedHeader.getAttribute("data-date");
        const job_id = resourceEl
          .closest("tr[data-resource-id]")
          ?.getAttribute("data-resource-id");
        const worker_id = active.id as string;

        if (dateStr && job_id) {
          const date = dateStr.slice(0, 10);
          const time = dateStr.slice(11, 16) || "07:00";
          clearForm(date);
          setFormWorkerId(worker_id);
          setFormJobId(job_id);
          setFormDate(date);
          setFormStartTime(time);
          setFormEndTime("15:30");
          setShowForm(true);
        }
      }
    }
  };

  async function handleEventDrop(info: any) {
    if (!info.event.id) return;
    const shiftedResource = info.event.getResources()[0];
    const jobId = shiftedResource?.id ?? info.event.extendedProps.job_id;
    if (!jobId) return;

    const date = info.event.startStr.slice(0, 10);
    const startTime = info.event.start?.toISOString().slice(11, 16);
    const endTime = info.event.end?.toISOString().slice(11, 16);
    if (!startTime || !endTime) return;

    await updateEntry(info.event.id, {
      job_id: jobId,
      date,
      start_time: startTime,
      end_time: endTime,
    });
  }

  function handleEventClick(clickInfo: any) {
    if (clickInfo.event.extendedProps.isGhost) {
      const ghost = ghostShifts.find((g) => g.id === clickInfo.event.id);
      if (ghost) setReviewGhostShift(ghost);
      return;
    }
    const entry = entries.find((entry) => entry.id === clickInfo.event.id);
    if (entry) {
      openEditForm(entry);
    }
  }

  function clearForm(dateOverride?: string) {
    setEditingShiftId(null);
    setFormWorkerId("");
    setFormJobId("");
    setFormDate(dateOverride ?? "");
    setFormStartTime("07:00");
    setFormEndTime("15:30");
    setFormNotes("");
    setConflictContext(null);
    setOverrideReason("");
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

  async function saveEntry(skipConflictCheck = false) {
    if (
      !formWorkerId ||
      !formJobId ||
      !formDate ||
      !formStartTime ||
      !formEndTime
    ) {
      return;
    }

    if (!skipConflictCheck) {
      // Find worker metadata for costing
      const targetWorker = workers.find((w) => w.id === formWorkerId);
      const hourlyRate = targetWorker?.metadata?.hourly_rate || 20;
      
      // Calculate requested hours
      const d1 = new Date(`1970-01-01T${formStartTime}:00Z`).getTime();
      const d2 = new Date(`1970-01-01T${formEndTime}:00Z`).getTime();
      const reqHours = (d2 - d1) / 3600000;

      // 1. PTO Conflict
      const isOverlappingPTO = ptoRequests.some(
        (p) =>
          p.user_id === formWorkerId &&
          p.start_date <= formDate &&
          p.end_date >= formDate,
      );
      if (isOverlappingPTO) {
        setConflictContext({
          type: "pto",
          title: "Worker on PTO",
          message: "This worker is taking Personal Time Off during this period. Are you sure you want to schedule them anyway?",
        });
        return;
      }

      // 2. Overbooking Conflict
      const isOverbooked = entries.some(
        (e) =>
          e.worker_id === formWorkerId &&
          e.date === formDate &&
          e.id !== editingShiftId &&
          ((e.start_time <= formStartTime && e.end_time > formStartTime) ||
            (e.start_time < formEndTime && e.end_time >= formEndTime) ||
            (e.start_time >= formStartTime && e.end_time <= formEndTime))
      );
      if (isOverbooked) {
        setConflictContext({
          type: "overbook",
          title: "Double Booked",
          message: "This worker already has a shift scheduled that overlaps with this time. Continue?",
        });
        return;
      }

      // 3. OT Threshold Conflict
      const weekEntries = entries.filter((e) => e.worker_id === formWorkerId && e.id !== editingShiftId);
      const currentHours = weekEntries.reduce((acc, curr) => {
        try {
          const t1 = new Date(`1970-01-01T${curr.start_time}:00Z`).getTime();
          const t2 = new Date(`1970-01-01T${curr.end_time}:00Z`).getTime();
          return acc + (t2 - t1) / 3600000;
        } catch { return acc; }
      }, 0);

      if (currentHours + reqHours > 40) {
        const excessHours = currentHours + reqHours - 40;
        const otRate = hourlyRate * 1.5;
        const impact = excessHours * otRate;
        setConflictContext({
          type: "overtime",
          title: "Overtime Threshold Exceeded",
          message: `This shift pushes the worker to ${currentHours + reqHours} hours for the week.`,
          costImpact: impact,
        });
        return;
      }
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
        notes: (overrideReason ? `[OVERRIDE: ${overrideReason}]\n` : "") + (formNotes.trim() || ""),
      });
      await loadSchedule();
      clearForm();
      setShowForm(false);
      setSuccessMessage(
        wasEditing
          ? t("schedulePage.draftUpdated")
          : t("schedulePage.draftSaved"),
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
      setError(
        err instanceof Error ? err.message : t("schedulePage.failedToRemove"),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function updateEntry(
    id: string,
    changes: Partial<
      Pick<
        ScheduleEntry,
        "worker_id" | "job_id" | "date" | "start_time" | "end_time" | "notes"
      >
    >,
  ) {
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
      setError(
        err instanceof Error ? err.message : t("schedulePage.failedToUpdate"),
      );
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
      await postSchedule({ action: "publish", shift_ids: draftIds });
      await loadSchedule();
      setSuccessMessage(t("schedulePage.published"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("schedulePage.failedToPublish"),
      );
    } finally {
      setBusyAction(null);
    }
  }

  const draftCount = entries.filter((entry) => entry.status === "draft").length;
  const isDraft = draftCount > 0;
  const publishedShifts = entries.filter(
    (entry) => entry.status === "published",
  );

  async function askAiForSuggestions() {
    setAiLoading(true);
    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing session");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/schedule_ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workers: workers.map((w) => w.id),
            jobs: jobs.map((j) => j.id),
            anchorDate: anchorDate,
          }),
        }
      );
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI failed");
      
      if (data.ghost_shifts) {
        setGhostShifts(data.ghost_shifts);
        setSuccessMessage("AI returned suggested shifts.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`AI suggestion error: ${message}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function resolveGhostShift(accept: boolean) {
    if (!reviewGhostShift) return;
    
    setGhostShifts((prev) => prev.filter((g) => g.id !== reviewGhostShift.id));
    
    if (accept) {
      setBusyAction("create");
      try {
        await postSchedule({
          action: "create",
          worker_id: reviewGhostShift.worker_id,
          job_id: reviewGhostShift.job_id,
          shift_date: reviewGhostShift.date,
          start_time: reviewGhostShift.start_time,
          end_time: reviewGhostShift.end_time,
          notes: reviewGhostShift.notes,
        });
        await loadSchedule();
        setSuccessMessage("AI shift accepted and saved as Draft.");
      } catch (err) {
        // handled globally or omitted for brevity
      } finally {
        setBusyAction(null);
      }
    }
    setReviewGhostShift(null);
  }

  function saveAsTemplate() {
    const name = templateNameInput.trim();
    if (!name) return;

    const weekStart = parseDate(rangeStart);
    const weekStartMs = weekStart.getTime();

    const templateShifts = entries
      .filter((e) => e.date >= rangeStart && e.date <= rangeEnd)
      .map((e) => {
        const shiftDate = parseDate(e.date);
        const dayOffset = Math.round((shiftDate.getTime() - weekStartMs) / 86400000);
        return {
          worker_id: e.worker_id,
          job_id: e.job_id,
          day_offset: dayOffset,
          start_time: e.start_time,
          end_time: e.end_time,
          notes: e.notes ?? "",
        };
      });

    if (templateShifts.length === 0) {
      setError("No shifts in the current range to save as a template.");
      return;
    }

    const newTemplate: ScheduleTemplate = {
      name,
      createdAt: new Date().toISOString(),
      shifts: templateShifts,
    };

    const updated = [...templates.filter((t) => t.name !== name), newTemplate];
    persistTemplates(updated);
    setTemplates(updated);
    setTemplateNameInput("");
    setShowTemplateInput(false);
    setSuccessMessage(`Template "${name}" saved (${templateShifts.length} shifts).`);
  }

  async function applyTemplate(template: ScheduleTemplate) {
    setShowApplyDropdown(false);
    if (template.shifts.length === 0) return;

    setBusyAction("copy");
    setError(null);
    setSuccessMessage(null);
    const weekStart = startOfWeek(parseDate(rangeStart));

    try {
      await Promise.all(
        template.shifts.map((shift) => {
          const targetDate = new Date(weekStart);
          targetDate.setUTCDate(weekStart.getUTCDate() + shift.day_offset);
          return postSchedule({
            action: "create",
            worker_id: shift.worker_id,
            job_id: shift.job_id,
            shift_date: asDateKey(targetDate),
            start_time: shift.start_time,
            end_time: shift.end_time,
            notes: shift.notes,
          });
        }),
      );
      await loadSchedule();
      setSuccessMessage(`Template "${template.name}" applied — ${template.shifts.length} draft shifts created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template.");
    } finally {
      setBusyAction(null);
    }
  }

  const copySourceLabel = useMemo(() => {
    const srcMonday = parseDate(previousAnchor(rangeStart, "week"));
    return srcMonday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [rangeStart]);

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

  async function handleCopyPreviousWeek() {
    setBusyAction("copy");
    setError(null);
    setSuccessMessage(null);
    try {
      const prevStart = previousAnchor(rangeStart, "week");
      const prevEnd = previousAnchor(rangeEnd, "week");
      await postSchedule({
        action: "copy_week",
        source_start: prevStart,
        source_end: prevEnd,
        target_start: rangeStart,
      });
      await loadSchedule();
      setSuccessMessage(t("schedulePage.weekCopied"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("schedulePage.failedToCopy"),
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
              <h2 className="text-2xl font-bold text-slate-900">
                {t("schedulePage.title")}
              </h2>
              <p className="mt-1 text-slate-600">
                {t("schedulePage.subtitle")}
              </p>
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
                onClick={askAiForSuggestions}
                disabled={aiLoading || Boolean(busyAction)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                {aiLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
                    Thinking...
                  </span>
                ) : (
                  "✦ AI Suggestions"
                )}
              </button>
              <button
                onClick={handleCopyPreviousWeek}
                disabled={busyAction === "copy"}
                className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {busyAction === "copy" ? "Copying..." : `Copy Week of ${copySourceLabel}`}
              </button>
              {showTemplateInput ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={templateNameInput}
                    onChange={(e) => setTemplateNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveAsTemplate();
                      if (e.key === "Escape") { setShowTemplateInput(false); setTemplateNameInput(""); }
                    }}
                    placeholder="Template name..."
                    className="rounded-xl border border-stone-300 px-3 py-2 text-sm w-40"
                  />
                  <button
                    onClick={saveAsTemplate}
                    disabled={!templateNameInput.trim()}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowTemplateInput(false); setTemplateNameInput(""); }}
                    className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-stone-200"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTemplateInput(true)}
                  className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50"
                >
                  Save as Template
                </button>
              )}
              {templates.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowApplyDropdown((v) => !v)}
                    className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50"
                  >
                    Apply Template ▾
                  </button>
                  {showApplyDropdown && (
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                      {templates.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => applyTemplate(t)}
                          className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-stone-50"
                        >
                          <span>{t.name}</span>
                          <span className="text-xs text-slate-400">{t.shifts.length}sh</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  {busyAction === "publish"
                    ? t("schedulePage.publishing")
                    : t("schedulePage.publishSchedule")}
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
              onClick={() =>
                setAnchorDate((current) => previousAnchor(current, viewMode))
              }
              className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
            >
              {t("schedulePage.prevRange")}
            </button>
            <span className="text-sm font-semibold text-slate-900">
              {rangeLabel}
            </span>
            <button
              onClick={() =>
                setAnchorDate((current) => nextAnchor(current, viewMode))
              }
              className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
            >
              {t("schedulePage.nextRange")}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              {editingShiftId
                ? t("schedulePage.editShiftTitle")
                : t("schedulePage.addShiftTitle")}
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
                onClick={() => saveEntry(false)}
                disabled={
                  Boolean(busyAction) ||
                  !formWorkerId ||
                  !formJobId ||
                  !formDate ||
                  !formStartTime ||
                  !formEndTime
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

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Workers</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {filteredWorkers.length}
              </span>
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("schedulePage.searchWorkers")}
              </label>
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={t("schedulePage.searchWorkersPlaceholder")}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </div>

            <div className="space-y-3">
              {filteredWorkers.map((worker) => {
                const isOverlappingPTO = ptoRequests.some(
                  (p) =>
                    p.user_id === worker.id &&
                    p.start_date <= rangeEnd &&
                    p.end_date >= rangeStart,
                );
                const currentHours = entries
                  .filter((e) => e.worker_id === worker.id)
                  .reduce((acc, curr) => {
                    try {
                      const d1 = new Date(
                        `1970-01-01T${curr.start_time}:00Z`,
                      ).getTime();
                      const d2 = new Date(
                        `1970-01-01T${curr.end_time}:00Z`,
                      ).getTime();
                      return acc + (d2 - d1) / 3600000;
                    } catch {
                      return acc;
                    }
                  }, 0);
                return (
                  <DraggableWorker
                    key={worker.id}
                    worker={worker}
                    isOverlappingPTO={isOverlappingPTO}
                    currentHours={currentHours}
                  />
                );
              })}
              {filteredWorkers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white/80 px-4 py-3 text-sm text-slate-500">
                  {t("schedulePage.noWorkersFound")}
                </div>
              )}
            </div>
          </aside>

          <div className="flex items-center gap-4 px-1 pb-2 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
              Draft
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
              Published
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-400" />
              AI Suggestion
            </span>
          </div>
          <div className="relative min-w-0 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <div className="min-w-[800px]">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[interactionPlugin, resourceTimelinePlugin]}
                  initialView={calendarView}
                  visibleRange={visibleRange}
                  resources={resources}
                  events={events}
                  editable
                  droppable
                  eventDurationEditable
                  eventResizableFromStart
                  height="auto"
                  slotMinTime="05:00:00"
                  slotMaxTime="20:00:00"
                  slotDuration={currentSlotDuration}
                  resourceAreaHeaderContent={t("schedulePage.jobs") || "Jobs"}
                  resourceAreaWidth="260px"
                  headerToolbar={false}
                  eventDrop={handleEventDrop}
                  eventResize={handleEventDrop}
                  eventClick={handleEventClick}
                  dayMaxEventRows={true}
                  displayEventTime
                  schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
                />
              </div>

            {!loading && entries.length === 0 && ghostShifts.length === 0 && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-slate-400 pointer-events-none">
                <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <p className="text-sm font-medium">No shifts scheduled</p>
                <p className="text-xs">Drag a worker from the left panel to get started</p>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 text-sm font-medium text-slate-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500 mb-2"></div>
                {t("common.loading")}
              </div>
            )}
          </div>
        </div>

        <Dialog open={!!conflictContext} onOpenChange={(open) => !open && setConflictContext(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {conflictContext?.title}
              </DialogTitle>
              <DialogDescription className="py-3 text-slate-700">
                {conflictContext?.message}
                {conflictContext?.costImpact && (
                   <div className="mt-3 rounded-lg bg-rose-50 p-3 font-semibold text-rose-800">
                     Estimated OT Impact: +${conflictContext.costImpact.toFixed(2)}
                   </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Label htmlFor="overrideReason" className="text-slate-700">
                Override Reason <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="overrideReason"
                type="text"
                placeholder="e.g. Critical site coverage needed"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className={`w-full ${!overrideReason.trim() ? "border-rose-300 focus-visible:ring-rose-300" : ""}`}
              />
              <p className="mt-1 text-xs text-slate-400">Reason is logged with the shift for audit trail.</p>
            </div>
            <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setConflictContext(null)}
                className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!overrideReason.trim() || Boolean(busyAction)}
                onClick={() => saveEntry(true)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busyAction ? "Saving..." : "Confirm Override"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!isDraft && publishedShifts.length > 0 && (
          <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            ✓ {t("schedulePage.published")}
          </div>
        )}

        <DragOverlay>
          {activeWorker ? (
            <div className="cursor-grabbing rounded-2xl border-2 border-indigo-400 bg-white px-4 py-3 shadow-2xl ring-2 ring-indigo-100">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-slate-900">{activeWorker.full_name}</div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {activeWorker.role}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Drop onto a job row
              </div>
            </div>
          ) : null}
        </DragOverlay>

        <Dialog open={!!reviewGhostShift} onOpenChange={(open) => !open && setReviewGhostShift(null)}>
          <DialogContent className="sm:max-w-md border-indigo-100 shadow-xl shadow-indigo-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Shift Suggestion
              </DialogTitle>
              <DialogDescription className="py-2 text-slate-700">
                This shift is recommended based on historical skills and job requirements. 
                <br /><br />
                <span className="font-semibold text-slate-900 block">{workers.find(w => w.id === reviewGhostShift?.worker_id)?.full_name}</span>
                <span className="block">
                  {reviewGhostShift?.date
                    ? parseDate(reviewGhostShift.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    : ""}{" "}
                  · {reviewGhostShift?.start_time} – {reviewGhostShift?.end_time}
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => resolveGhostShift(false)}
                className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-200"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => resolveGhostShift(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Accept Selection
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DndContext>
  );
}
