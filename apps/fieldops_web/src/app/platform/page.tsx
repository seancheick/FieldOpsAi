"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlatformIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/platform/companies");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
        <span>Redirecting to Platform Companies...</span>
      </div>
    </div>
  );
}
