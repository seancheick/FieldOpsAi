"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  Users,
  ArrowRight,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Clock,
  Power,
} from "lucide-react";
import type { CompanySummary } from "@/lib/types";

interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  trialingCompanies: number;
  pastDueCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  estimatedMrr: number;
}

type FilterTab = "all" | "active" | "trialing" | "past_due" | "suspended";

export default function PlatformCompaniesDashboard() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    trialingCompanies: 0,
    pastDueCompanies: 0,
    suspendedCompanies: 0,
    totalUsers: 0,
    estimatedMrr: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Local Next.js API route — zero CORS issues, backed by server service role
      const res = await fetch("/api/platform/companies");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? `API error (${res.status})`);
      }

      const data = await res.json();
      setCompanies(data.companies ?? []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleToggleKillswitch = async (comp: CompanySummary) => {
    const isCurrentlySuspended = comp.status === "suspended";
    const nextStatus = isCurrentlySuspended ? "active" : "suspended";

    const confirmed = window.confirm(
      isCurrentlySuspended
        ? `Reactivate ${comp.name}? All company workers and foremen will have their access restored immediately.`
        : `⚠️ KILLSWITCH ALERT: Are you sure you want to SUSPEND ${comp.name}? All workers and admins in this company will be banned from logging in immediately.`
    );
    if (!confirmed) return;

    setTogglingId(comp.id);
    try {
      const res = await fetch(`/api/platform/companies/${comp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to toggle status");
      }
      await fetchCompanies();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      // Tab filter
      if (activeTab === "active") {
        if (c.status === "suspended" || c.payment_status === "past_due") return false;
      } else if (activeTab === "trialing") {
        if (c.payment_status !== "trialing") return false;
      } else if (activeTab === "past_due") {
        if (c.payment_status !== "past_due") return false;
      } else if (activeTab === "suspended") {
        if (c.status !== "suspended") return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.industry && c.industry.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [companies, activeTab, searchQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Super Admin Console
            </span>
            <span className="text-xs text-slate-500">• Platform Health Live</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Client Companies & Revenue Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Monitor client companies, active seats, subscription health, and instant killswitch controls.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchCompanies()}
            disabled={loading}
            aria-label="Refresh company data"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/platform/companies/new"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <Plus size={15} />
            <span>Onboard Company</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Estimated MRR */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly Recurring Rev
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            ${stats.estimatedMrr.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-slate-500">/mo</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <span>● Live Platform Subscription</span>
          </div>
        </div>

        {/* Active Companies */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Client Companies
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Building2 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalCompanies}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {stats.activeCompanies} Active • {stats.trialingCompanies} Trialing
          </div>
        </div>

        {/* Payment Pending */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Payment Pending / Late
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.pastDueCompanies}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {stats.pastDueCompanies > 0 ? "⚠️ Requires billing outreach" : "All accounts in good standing"}
          </div>
        </div>

        {/* Total Active Workers */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Active Crew
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalUsers}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Workers across all client accounts
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-100/60 p-1 dark:border-slate-800 dark:bg-slate-900/60">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            All Companies ({stats.totalCompanies})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "active"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            Active & Paid ({stats.activeCompanies})
          </button>
          <button
            onClick={() => setActiveTab("trialing")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "trialing"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            In Trial ({stats.trialingCompanies})
          </button>
          <button
            onClick={() => setActiveTab("past_due")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "past_due"
                ? "bg-white text-rose-600 shadow-sm dark:bg-slate-800 dark:text-rose-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            Payment Pending ({stats.pastDueCompanies})
          </button>
          <button
            onClick={() => setActiveTab("suspended")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "suspended"
                ? "bg-white text-rose-600 shadow-sm dark:bg-slate-800 dark:text-rose-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            Suspended ({stats.suspendedCompanies})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search company or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Companies Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Company & Industry</th>
                <th className="px-4 py-3.5">Payment Status</th>
                <th className="px-4 py-3.5">Killswitch Status</th>
                <th className="px-4 py-3.5">Active Crew</th>
                <th className="px-4 py-3.5">Est. Revenue</th>
                <th className="px-4 py-3.5">Onboarded</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-slate-800/60">
              {loading && companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                      <span>Loading client companies...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No client companies match the selected criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((comp) => {
                  const isSuspended = comp.status === "suspended";
                  const payment = comp.payment_status ?? "trialing";
                  const userCount = comp.active_user_count ?? 0;
                  const estRevenue = isSuspended ? 0 : 299 + userCount * 15;

                  return (
                    <tr
                      key={comp.id}
                      className="transition-colors hover:bg-stone-50/60 dark:hover:bg-slate-800/40"
                    >
                      {/* Name & Industry */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            <Building2 size={18} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {comp.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-mono text-slate-400">/{comp.slug}</span>
                              {comp.industry && (
                                <span className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {comp.industry.replace("_", " ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="px-4 py-4">
                        {payment === "active" || payment === "paid" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Paid (Active)
                          </span>
                        ) : payment === "trialing" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                            <Clock size={11} />
                            In Trial
                          </span>
                        ) : payment === "past_due" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                            <AlertCircle size={11} />
                            Payment Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {payment}
                          </span>
                        )}
                      </td>

                      {/* Killswitch Status */}
                      <td className="px-4 py-4">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-100/70 px-2.5 py-0.5 font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                            <Power size={11} />
                            SUSPENDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Active Crew */}
                      <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Users size={13} className="text-slate-400" />
                          <span>{userCount} workers</span>
                        </div>
                      </td>

                      {/* Est. Revenue */}
                      <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">
                        ${estRevenue} /mo
                      </td>

                      {/* Onboarded Date */}
                      <td className="px-4 py-4 text-slate-500">
                        {new Date(comp.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleKillswitch(comp)}
                            disabled={togglingId === comp.id}
                            title={isSuspended ? "Reactivate company" : "Suspend company (Killswitch)"}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                              isSuspended
                                ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30"
                                : "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400"
                            }`}
                          >
                            <Power size={12} className={togglingId === comp.id ? "animate-spin" : ""} />
                            <span>{isSuspended ? "Reactivate" : "Killswitch"}</span>
                          </button>
                          <Link
                            href={`/platform/companies/${comp.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <span>Inspect</span>
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
