"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, UserPlus, Check, Copy } from "lucide-react";
import type { PlatformAdmin } from "@/lib/types";

export default function PlatformAdminsPage() {
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/platform/admins");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Failed to fetch admins (${res.status})`);

      setAdmins(data.admins ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    setInviteLink(null);

    try {
      const res = await fetch("/api/platform/admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Invite failed (${res.status})`);
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const claimUrl = `${origin}/claim?token=${data.claim_token}`;
      setInviteLink(claimUrl);
      setInviteEmail("");
      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite admin");
    } finally {
      setInviting(false);
    }
  };

  const copyInvite = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <Link
        href="/platform/companies"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Companies
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Platform Super Admins
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Accounts with unrestricted master access across all tenant companies and platform functions.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Invite Super Admin Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          <UserPlus className="h-4 w-4 text-amber-500" />
          Invite New Super Admin
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            placeholder="colleague@domain.com"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors disabled:opacity-50"
          >
            {inviting ? "Creating Invite..." : "Send Invite"}
          </button>
        </form>

        {inviteLink && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20 space-y-2">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              ✅ Super Admin invite link generated (valid for 48 hours):
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 rounded border border-emerald-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current Platform Admins Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        {loading ? (
          <div className="flex h-36 items-center justify-center text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
              <span>Loading administrators...</span>
            </div>
          </div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No platform administrators found.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3 font-semibold">Administrator</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Granted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {a.full_name || "Platform Admin"}
                    </div>
                    <div className="text-xs text-slate-400">{a.email}</div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Super Admin
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-400">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "Master"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
