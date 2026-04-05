"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function NavBar() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    try {
      const supabase = getSupabase();
      supabase.auth.getSession().then(({ data }) => {
        setUserEmail(data.session?.user?.email ?? null);
      });

      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUserEmail(session?.user?.email ?? null);
        },
      );

      return () => listener.subscription.unsubscribe();
    } catch {
      // Supabase not configured yet
    }
  }, []);

  return (
    <nav className="border-b border-stone-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">
          {t("shell.appName")}
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {t("shell.supervisor")}
          </span>
        </h1>
        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <a href="/map" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.map")}
          </a>
          <a href="/workers" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.workers")}
          </a>
          <a href="/" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.dashboard")}
          </a>
          <a href="/timeline" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.timeline")}
          </a>
          <a href="/photos" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.photos")}
          </a>
          <a href="/expenses" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.expenses")}
          </a>
          <a href="/schedule" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.schedule")}
          </a>
          <a href="/cost-codes" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.costCodes")}
          </a>
          <a href="/overtime" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.overtime")}
          </a>
          <a href="/reports" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            {t("shell.reports")}
          </a>
          <select
            aria-label={t("shell.language")}
            value={locale}
            onChange={(event) => setLocale(event.target.value as "en" | "es")}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="en">{t("shell.english")}</option>
            <option value="es">{t("shell.spanish")}</option>
          </select>
          {userEmail && (
            <>
              <span className="text-xs text-slate-400">{userEmail}</span>
              <button
                onClick={() => signOut()}
                className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-stone-200"
              >
                {t("shell.signOut")}
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
