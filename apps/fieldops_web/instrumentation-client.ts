import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN } from "./src/lib/observability";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  environment: process.env.NODE_ENV ?? "development",
  initialScope: { tags: { app: "web", runtime: "browser" } },
  denyUrls: [
    /extensions\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
  ],
  ignoreErrors: [
    /runtime\.sendMessage/i,
    /Tab not found/i,
    /ResizeObserver loop/i,
    /Non-Error promise rejection/i,
  ],
  beforeSend(event, hint) {
    const error = hint?.originalException;
    const message =
      (error instanceof Error ? error.message : "") ||
      event.message ||
      (event.exception?.values?.[0]?.value ?? "");

    // Filter browser extension errors injected into the window context
    if (
      message.includes("runtime.sendMessage") ||
      message.includes("Tab not found") ||
      message.includes("Extension context invalidated")
    ) {
      return null;
    }

    return event;
  },
  // Session replay only when an error occurs — worth its weight in repro
  // steps for "it broke when I clicked X" beta reports, negligible volume.
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
