import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

const DEFAULT_SUPABASE_URL = "https://cpqrazrszhcxjvursuci.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwcXJhenJzemhjeGp2dXJzdWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzc5ODEsImV4cCI6MjA5MDgxMzk4MX0.W9InOewMmI_SI25webZyoH8MBmx2jhhlkLo5q7bmtdE";

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  _client = createClient(url, key);
  return _client;
}
