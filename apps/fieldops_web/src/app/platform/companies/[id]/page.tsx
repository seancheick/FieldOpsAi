"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { CompanyDetail, CompanyUser, AuditLogEntry } from "@/lib/types";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    suspended: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    trialing: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
        styles[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

export default function PlatformCompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);

  const apiCall = useCallback(async (query: string, method = "GET", body?: Record<string, unknown>) => {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) throw new Error("No active session");

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cpqrazrszhcxjvursuci.supabase.co";
    const res = await fetch(`${baseUrl}/functions/v1/platform_admin?${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? data.message ?? `API error (${res.status})`);
    return data;
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [companyData, usersData, auditData] = await Promise.all([
        apiCall(`action=company_detail&company_id=${companyId}`),
        apiCall(`action=company_users&company_id=${companyId}`),
        apiCall(`action=audit&company_id=${companyId}&limit=20`),
      ]);

      setCompany(companyData.company ?? companyData);
      setUsers(usersData.users ?? usersData);
      setAudit(auditData.audit_logs ?? auditData.audit ?? auditData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load company details");
    } finally {
      setLoading(false);
    }
  }, [apiCall, companyId]);

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId, fetchAll]);

  const toggleStatus = async () => {
    if (!company) return;
    const newStatus = company.status === "active" ? "suspended" : "active";
    const confirmed = window.confirm(
      newStatus === "suspended"
        ? "⚠️ Are you sure you want to SUSPEND this company? All users in this company will be banned from logging in immediately."
        : "Reactivate this company? All employees will have their access restored."
    );
    if (!confirmed) return;

    setToggling(true);
    try {
      await apiCall("", "POST", {
        action: "toggle_company",
        company_id: companyId,
        status: newStatus,
      });
      await fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update company status");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          <span>Loading company record...</span>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="space-y-4">
        <Link
          href="/platform/companies"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Companies
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error || "Company not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/platform/companies"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Companies
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {company.name}
            </h1>
            <StatusBadge status={company.status} />
          </div>
          <p className="text-xs text-slate-400">ID: {company.id} • Slug: {company.slug}</p>
        </div>

        {/* Killswitch button */}
        <button
          onClick={toggleStatus}
          disabled={toggling}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            company.status === "active"
              ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {company.status === "active" ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              {toggling ? "Suspending..." : "Suspend Company"}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {toggling ? "Reactivating..." : "Reactivate Company"}
            </>
          )}
        </button>
      </div>

      {/* Grid: Company Details & Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-400">Industry</div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            {company.industry || "General"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-400">Timezone</div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            {company.timezone || "America/New_York"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-400">Created On</div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            {new Date(company.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Users Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <Users className="h-5 w-5 text-amber-500" />
            Company Users ({users.length})
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No users provisioned for this company yet.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {u.full_name}
                      </div>
                      <div className="text-xs text-slate-400">{u.email || "No email"}</div>
                    </td>
                    <td className="px-6 py-3 capitalize">{u.role}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.is_active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Audit Log Section */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          <History className="h-5 w-5 text-amber-500" />
          Recent Audit History
        </h2>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          {audit.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-4">
              No audit logs recorded for this company yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
              {audit.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{item.action}</span>
                    <span className="text-slate-400">by {item.actor_email}</span>
                  </div>
                  <span className="text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
