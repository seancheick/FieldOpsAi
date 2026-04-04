"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

interface OTRequest {
  id: string;
  job_id: string;
  worker_id: string;
  requested_at: string;
  total_hours_at_request: number | null;
  notes: string | null;
  status: string;
  users: { full_name: string } | null;
  jobs: { name: string; code: string } | null;
}

export default function OvertimePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Loading...
        </div>
      }
    >
      <OvertimeContent />
    </Suspense>
  );
}

function OvertimeContent() {
  const searchParams = useSearchParams();
  const filterStatus = searchParams.get("status") || "pending";

  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from("ot_requests")
        .select(`
          id,
          job_id,
          worker_id,
          requested_at,
          total_hours_at_request,
          notes,
          status,
          users!ot_requests_worker_id_fkey ( full_name ),
          jobs!ot_requests_job_id_fkey ( name, code )
        `)
        .eq("status", filterStatus)
        .order("requested_at", { ascending: false })
        .limit(50);

      if (err) throw err;
      setRequests((data as unknown as OTRequest[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load OT requests");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleDecision(
    requestId: string,
    decision: "approved" | "denied",
    reason: string,
  ) {
    setDecidingId(requestId);
    try {
      const supabase = getSupabase();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            action: "decide",
            ot_request_id: requestId,
            decision,
            reason,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Decision failed");
      }

      await loadRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setDecidingId(null);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
          Overtime Approvals
        </h2>
        <p className="mt-1 text-slate-600">
          Review and approve worker overtime requests.
        </p>

        {/* Status filter tabs */}
        <div className="mt-4 flex gap-2">
          {["pending", "approved", "denied"].map((s) => (
            <a
              key={s}
              href={`/overtime?status=${s}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                filterStatus === s
                  ? "bg-amber-500 text-white"
                  : "bg-stone-100 text-slate-600 hover:bg-stone-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </a>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Loading requests...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            onClick={loadRequests}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
          No {filterStatus} overtime requests.
        </div>
      )}

      <div className="space-y-4">
        {requests.map((req) => (
          <OTRequestCard
            key={req.id}
            request={req}
            isPending={filterStatus === "pending"}
            isDeciding={decidingId === req.id}
            onDecision={handleDecision}
            formatTime={formatTime}
          />
        ))}
      </div>
    </div>
  );
}

function OTRequestCard({
  request,
  isPending,
  isDeciding,
  onDecision,
  formatTime,
}: {
  request: OTRequest;
  isPending: boolean;
  isDeciding: boolean;
  onDecision: (
    id: string,
    decision: "approved" | "denied",
    reason: string,
  ) => void;
  formatTime: (iso: string) => string;
}) {
  const [reason, setReason] = useState("");
  const [showReasonFor, setShowReasonFor] = useState<
    "approved" | "denied" | null
  >(null);

  const workerName =
    (request.users as { full_name: string } | null)?.full_name ?? "Unknown worker";
  const jobName =
    (request.jobs as { name: string; code: string } | null)?.name ?? "Unknown job";
  const jobCode =
    (request.jobs as { name: string; code: string } | null)?.code ?? "";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-900">{workerName}</h3>
          <p className="text-sm text-slate-500">
            {jobName} ({jobCode})
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            request.status === "pending"
              ? "bg-amber-100 text-amber-700"
              : request.status === "approved"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {request.status}
        </span>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-slate-600">
        <span>Requested: {formatTime(request.requested_at)}</span>
        {request.total_hours_at_request != null && (
          <span>Hours: {request.total_hours_at_request}h</span>
        )}
      </div>

      {request.notes && (
        <p className="mt-2 text-sm text-slate-600 italic">
          &ldquo;{request.notes}&rdquo;
        </p>
      )}

      {isPending && (
        <div className="mt-4">
          {showReasonFor ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Reason for {showReasonFor === "approved" ? "approval" : "denial"}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                rows={2}
                placeholder="Required — explain your decision..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (reason.trim()) {
                      onDecision(request.id, showReasonFor!, reason);
                    }
                  }}
                  disabled={!reason.trim() || isDeciding}
                  className={`rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                    showReasonFor === "approved"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isDeciding
                    ? "Submitting..."
                    : `Confirm ${showReasonFor === "approved" ? "Approval" : "Denial"}`}
                </button>
                <button
                  onClick={() => {
                    setShowReasonFor(null);
                    setReason("");
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowReasonFor("approved")}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => setShowReasonFor("denied")}
                className="rounded-xl bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Deny
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
