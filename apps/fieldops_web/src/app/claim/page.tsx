"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

function ClaimInviteContent() {
  const searchParams = useSearchParams();
  const inviteToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!inviteToken) {
        throw new Error("Missing invite token in URL.");
      }

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cpqrazrszhcxjvursuci.supabase.co";
      const res = await fetch(`${baseUrl}/functions/v1/platform_admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_invite",
          invite_token: inviteToken,
          email: form.email.trim(),
          full_name: form.fullName.trim(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `Claim failed (${res.status})`);
      }

      setSuccess("Invite claimed! Your Super Admin account has been activated.");
      setForm({ email: "", fullName: "", password: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-amber-500" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Claim Super Admin Invite</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Activate your master platform administrator account.
      </p>

      {!inviteToken && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          Missing invite token in link. Please verify the URL.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {success ? (
        <div className="mt-6 space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{success}</p>
          <Link
            href="/"
            className="inline-block w-full rounded-lg bg-amber-500 hover:bg-amber-600 py-2.5 text-center text-sm font-semibold text-slate-950 transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="you@domain.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !inviteToken}
            className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 py-2.5 text-sm font-semibold text-slate-950 transition-colors disabled:opacity-50"
          >
            {submitting ? "Activating Account..." : "Activate Super Admin"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ClaimInvitePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
            Loading invite...
          </div>
        }
      >
        <ClaimInviteContent />
      </Suspense>
    </div>
  );
}
