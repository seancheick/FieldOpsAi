"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/", labelKey: "shell.dashboard", section: "overview" },
  { href: "/map", labelKey: "shell.map", section: "overview" },
  { href: "/workers", labelKey: "shell.workers", section: "overview" },
  { href: "/schedule", labelKey: "shell.schedule", section: "operations" },
  { href: "/timeline", labelKey: "shell.timeline", section: "operations" },
  { href: "/photos", labelKey: "shell.photos", section: "operations" },
  { href: "/expenses", labelKey: "shell.expenses", section: "operations" },
  { href: "/cost-codes", labelKey: "shell.costCodes", section: "operations" },
  { href: "/overtime", labelKey: "shell.overtime", section: "operations" },
  { href: "/pto", labelKey: "shell.pto", section: "operations" },
  { href: "/reports", labelKey: "shell.reports", section: "reports" },
  { href: "/settings", labelKey: "shell.company", section: "settings" },
  { href: "/settings/staff", labelKey: "shell.staff", section: "settings", adminOnly: true },
  { href: "/onboarding", labelKey: "shell.onboarding", section: "settings", adminOnly: true },
] as const;

const SECTIONS: Record<string, string> = {
  overview: "shell.overview",
  operations: "shell.operations",
  reports: "shell.reports",
  settings: "shell.settings",
};

export function Sidebar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    try {
      const supabase = getSupabase();
      supabase.auth.getSession().then(async ({ data }) => {
        setUserEmail(data.session?.user?.email ?? null);
        if (data.session?.user?.id) {
          const { data: user } = await supabase
            .from("users")
            .select("role")
            .eq("id", data.session.user.id)
            .maybeSingle();
          setUserRole(user?.role ?? null);
        }
      });
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => setUserEmail(session?.user?.email ?? null),
      );
      return () => listener.subscription.unsubscribe();
    } catch {
      // Not configured
    }
  }, []);

  const isAdmin = userRole === "admin";
  const visibleItems = NAV_ITEMS.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);
  const grouped = Object.entries(SECTIONS).map(([key, label]) => ({
    section: t(label),
    items: visibleItems.filter((item) => item.section === key),
  }));

  return (
    <aside className="flex w-56 flex-col border-r border-stone-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-sm font-bold text-white shadow-sm">
          F
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-slate-900">
            {t("shell.appName")}
          </div>
          <div className="text-[10px] font-medium text-slate-400">
            {t("shell.commandCenter")}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {grouped.map((group) => (
          <div key={group.section} className="mb-4">
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-300">
              {group.section}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`mb-px flex items-center rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:bg-stone-50 hover:text-slate-900"
                  }`}
                >
                  {t(item.labelKey)}
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-stone-100 px-4 py-4">
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-slate-300">
          {t("shell.language")}
        </label>
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as "en" | "es")}
          className="mb-3 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12px] font-medium text-slate-500"
        >
          <option value="en">{t("shell.english")}</option>
          <option value="es">{t("shell.spanish")}</option>
        </select>
        {userEmail && (
          <div className="mb-2 truncate text-[11px] text-slate-400">
            {userEmail}
          </div>
        )}
        {userEmail && (
          <button
            onClick={() => signOut()}
            className="w-full rounded-lg py-1.5 text-[12px] font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            {t("shell.signOut")}
          </button>
        )}
      </div>
    </aside>
  );
}
