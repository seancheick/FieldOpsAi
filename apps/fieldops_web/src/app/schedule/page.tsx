"use client";

import { useCallback, useEffect, useState } from "react";
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
  date: string;
  start_time: string;
  end_time: string;
  status: "draft" | "published";
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SchedulePage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split("T")[0];
  });
  const [selectedWorker, setSelectedWorker] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = getSupabase();
    const { data: w } = await supabase
      .from("users")
      .select("id, full_name, role")
      .eq("is_active", true)
      .in("role", ["worker", "foreman"])
      .order("full_name");
    setWorkers(w ?? []);

    const { data: j } = await supabase
      .from("jobs")
      .select("id, name, code")
      .in("status", ["active", "in_progress"])
      .order("name");
    setJobs(j ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getWeekDates() {
    const start = new Date(weekStart);
    return DAYS.map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  function addEntry() {
    if (!selectedWorker || !selectedJob || !selectedDay) return;
    const worker = workers.find((w) => w.id === selectedWorker);
    const job = jobs.find((j) => j.id === selectedJob);
    if (!worker || !job) return;

    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        worker_id: worker.id,
        worker_name: worker.full_name,
        job_id: job.id,
        job_name: job.name,
        date: selectedDay,
        start_time: "07:00",
        end_time: "15:30",
        status: "draft",
      },
    ]);
    setShowAddForm(false);
    setSelectedWorker("");
    setSelectedJob("");
    setSelectedDay("");
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function publishSchedule() {
    setEntries((prev) =>
      prev.map((e) => ({ ...e, status: "published" as const })),
    );
    setIsDraft(false);
    // TODO: Call backend to persist and send notifications to workers
  }

  const weekDates = getWeekDates();
  const draftCount = entries.filter((e) => e.status === "draft").length;

  return (
    <div>
      <div className="mb-6">
        <a
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> Back to Dashboard
        </a>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Schedule</h2>
            <p className="mt-1 text-slate-600">
              Drag shifts, edit, then publish to notify your crew.
            </p>
          </div>
          <div className="flex gap-3">
            {isDraft && entries.length > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {draftCount} draft shift{draftCount !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              + Add Shift
            </button>
            {isDraft && entries.length > 0 && (
              <button
                onClick={publishSchedule}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Publish Schedule
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() - 7);
            setWeekStart(d.toISOString().split("T")[0]);
          }}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
        >
          ← Prev Week
        </button>
        <span className="text-sm font-semibold text-slate-900">
          Week of{" "}
          {new Date(weekStart).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <button
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 7);
            setWeekStart(d.toISOString().split("T")[0]);
          }}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-stone-200"
        >
          Next Week →
        </button>
      </div>

      {/* Add shift form */}
      {showAddForm && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">
            Add Shift
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Worker
              </label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              >
                <option value="">Select worker</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Job
              </label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              >
                <option value="">Select job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Day
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              >
                <option value="">Select day</option>
                {weekDates.map((date, i) => (
                  <option key={date} value={date}>
                    {DAYS[i]} —{" "}
                    {new Date(date + "T12:00:00").toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={addEntry}
              disabled={!selectedWorker || !selectedJob || !selectedDay}
              className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Add Shift
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-stone-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b bg-stone-50">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className="border-r px-3 py-3 text-center text-xs font-semibold text-slate-500 last:border-r-0"
            >
              {day}
              <br />
              <span className="text-slate-400">
                {new Date(weekDates[i] + "T12:00:00").toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" },
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="grid min-h-[300px] grid-cols-7">
          {weekDates.map((date) => {
            const dayEntries = entries.filter((e) => e.date === date);
            return (
              <div
                key={date}
                className="border-r p-2 last:border-r-0"
              >
                {dayEntries.length === 0 && (
                  <div className="flex h-20 items-center justify-center text-xs text-slate-300">
                    No shifts
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
                    <div className="text-[10px] opacity-75">
                      {entry.job_name}
                    </div>
                    <div className="text-[10px] opacity-60">
                      {entry.start_time}–{entry.end_time}
                    </div>
                    {entry.status === "draft" && (
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="mt-1 text-[10px] font-semibold text-red-500 hover:text-red-700"
                      >
                        Remove
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
          ✓ Schedule published. Workers will be notified.
        </div>
      )}
    </div>
  );
}
