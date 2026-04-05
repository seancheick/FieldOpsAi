"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/posthog";
import { LocaleProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <LocaleProvider>{children}</LocaleProvider>;
}
