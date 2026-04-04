"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

export function NavBar() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
          FieldOps AI
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            Supervisor
          </span>
        </h1>
        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <a href="/map" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Map
          </a>
          <a href="/workers" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Workers
          </a>
          <a href="/" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Dashboard
          </a>
          <a href="/timeline" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Timeline
          </a>
          <a href="/photos" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Photos
          </a>
          <a href="/schedule" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Schedule
          </a>
          <a href="/overtime" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Overtime
          </a>
          <a href="/reports" className="rounded-lg px-3 py-1.5 hover:bg-stone-100 hover:text-slate-900">
            Reports
          </a>
          {userEmail && (
            <>
              <span className="text-xs text-slate-400">{userEmail}</span>
              <button
                onClick={() => signOut()}
                className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-stone-200"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
