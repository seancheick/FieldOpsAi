"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { callFunctionJson } from "@/lib/function-client";
import { SkeletonCard } from "@/components/ui/skeleton";

interface PTORequest {
  id: string;
  user_id: string;
  pto_type: string;
  start_date: string;
  end_date: string;
  day_count: number;
  status: string;
  notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
  users: { full_name: string } | null;
}

interface PTOListResponse {
  requests?: PTORequest[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-amber-100", text: "text-amber-700" },
  approved: { bg: "bg-green-100", text: "text-green-700" },
  denied: { bg: "bg-red-100", text: "text-red-700" },
  cancelled: { bg: "bg-stone-100", text: "text-stone-500" },
};

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
};

export default function PTOPage() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("pending");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState("");

  const loadRequests = useCallback(async () => {
    setError(null);
    try {
      const payload = await callFunctionJson<PTOListResponse>("pto", {
        query: { status: filter },
      });
      setRequests(payload.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PTO requests");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadRequests();
  }, [loadRequests]);

  async function handleDecision(requestId: string, decision: "approved" | "denied") {
    try {
      await callFunctionJson("pto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "decide",
          pto_request_id: requestId,
          decision,
          reason: decisionReason || undefined,
        }),
      });

      setDecidingId(null);
      setDecisionReason("");
      loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    }
  }

  const kpiStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const pendingCount = requests.filter((r) => r.status === "pending").length;
    const upcomingApproved = requests.filter(
      (r) => r.status === "approved" && r.start_date >= todayStr,
    ).length;
    const daysOffThisMonth = requests
      .filter((r) => {
        if (r.status !== "approved") return false;
        const start = new Date(r.start_date);
        return start.getMonth() === currentMonth && start.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + r.day_count, 0);

    return { pendingCount, upcomingApproved, daysOffThisMonth };
  }, [requests]);

  return (
    <div>
      <div className="mb-6">
        <a href="/" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <h2 className="text-2xl font-bold text-slate-900">Time Off Requests</h2>
        <p className="mt-1 text-slate-600">Review and manage worker PTO requests.</p>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400">{t("ptoPage.pendingRequests")}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{kpiStats.pendingCount}</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400">{t("ptoPage.upcomingApproved")}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{kpiStats.upcomingApproved}</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400">{t("ptoPage.daysOffThisMonth")}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{kpiStats.daysOffThisMonth}</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {["pending", "approved", "denied", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === s
                ? "bg-amber-500 text-white"
                : "bg-stone-100 text-slate-600 hover:bg-stone-200"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-200 p-12 text-center text-sm text-slate-400">
          No {filter} PTO requests.
        </div>
      )}

      <div className="space-y-3">
        {requests.map((req) => {
          const colors = STATUS_COLORS[req.status] ?? STATUS_COLORS.pending;
          return (
            <div key={req.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    {req.users?.full_name ?? "Unknown"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {TYPE_LABELS[req.pto_type] ?? req.pto_type} &middot; {req.start_date} to {req.end_date} ({req.day_count} day{req.day_count !== 1 ? "s" : ""})
                  </div>
                  {req.notes && (
                    <div className="mt-2 text-sm text-slate-600">{req.notes}</div>
                  )}
                  {req.decision_reason && (
                    <div className="mt-2 text-xs text-slate-400">
                      Decision: {req.decision_reason}
                    </div>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${colors.bg} ${colors.text}`}>
                  {req.status.toUpperCase()}
                </span>
              </div>

              {/* Decision UI for pending requests */}
              {req.status === "pending" && (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  {decidingId === req.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        placeholder="Reason (optional)..."
                        className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecision(req.id, "approved")}
                          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(req.id, "denied")}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Deny
                        </button>
                        <button
                          onClick={() => { setDecidingId(null); setDecisionReason(""); }}
                          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-stone-100"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDecidingId(req.id)}
                      className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                    >
                      Review &rarr;
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
