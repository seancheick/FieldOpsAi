"use client";

import { getSupabase } from "@/lib/supabase";

type QueryValue = string | number | boolean | null | undefined;

function buildFunctionUrl(path: string, query?: Record<string, QueryValue>) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }

  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`functions/v1/${normalizedPath}`, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseJsonSafely(response: Response) {
  const rawBody = await response.text();
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

export async function callFunctionJson<T>(
  path: string,
  options: RequestInit & { query?: Record<string, QueryValue> } = {},
): Promise<T> {
  const { query, headers, ...init } = options;
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Missing session");
  }

  const response = await fetch(buildFunctionUrl(path, query), {
    ...init,
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Request failed for ${path}`;
    throw new Error(message);
  }

  return payload as T;
}
