"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", section: "overview" },
  { href: "/map", label: "Live Map", section: "overview" },
  { href: "/workers", label: "Workers", section: "overview" },
  { href: "/schedule", label: "Schedule", section: "operations" },
  { href: "/timeline", label: "Timeline", section: "operations" },
  { href: "/photos", label: "Photo Feed", section: "operations" },
  { href: "/overtime", label: "Overtime", section: "operations" },
  { href: "/reports", label: "Reports", section: "reports" },
  { href: "/settings", label: "Company", section: "settings" },
  { href: "/settings/staff", label: "Staff", section: "settings" },
  { href: "/onboarding", label: "Onboarding", section: "settings" },
];

const SECTIONS: Record<string, string> = {
  overview: "Overview",
  operations: "Operations",
  reports: "Reports",
  settings: "Settings",
};

export function Sidebar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const supabase = getSupabase();
      supabase.auth.getSession().then(({ data }) => {
        setUserEmail(data.session?.user?.email ?? null);
      });
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => setUserEmail(session?.user?.email ?? null),
      );
      return () => listener.subscription.unsubscribe();
    } catch {
      // Not configured
    }
  }, []);

  const grouped = Object.entries(SECTIONS).map(([key, label]) => ({
    section: label,
    items: NAV_ITEMS.filter((item) => item.section === key),
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
            FieldOps AI
          </div>
          <div className="text-[10px] font-medium text-slate-400">
            Command Center
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
                  {item.label}
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
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
