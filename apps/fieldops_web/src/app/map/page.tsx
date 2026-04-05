"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";

const MAPTILER_KEY =
  process.env.NEXT_PUBLIC_MAPTILER_KEY || "3EVTjBsPJIuw0UVfaNvL";

interface WorkerPin {
  user_id: string;
  full_name: string;
  gps_lat: number;
  gps_lng: number;
  event_subtype: string;
  occurred_at: string;
  job_name: string;
}

interface JobSite {
  id: string;
  name: string;
  code: string;
  site_lat: number;
  site_lng: number;
  geofence_radius_m: number;
}

export default function MapPage() {
  const { t } = useI18n();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [workers, setWorkers] = useState<WorkerPin[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase();

      const { data: clockEvents } = await supabase
        .from("clock_events")
        .select(
          "user_id, gps_lat, gps_lng, event_subtype, occurred_at, users!clock_events_user_id_fkey(full_name), jobs!clock_events_job_id_fkey(name)",
        )
        .order("occurred_at", { ascending: false })
        .limit(100);

      const latestByWorker = new Map<string, WorkerPin>();
      for (const ce of clockEvents ?? []) {
        if (ce.gps_lat && ce.gps_lng && !latestByWorker.has(ce.user_id as string)) {
          latestByWorker.set(ce.user_id as string, {
            user_id: ce.user_id as string,
            full_name: (ce.users as any)?.full_name ?? t("mapPage.unknownWorker"),
            gps_lat: ce.gps_lat as number,
            gps_lng: ce.gps_lng as number,
            event_subtype: ce.event_subtype as string,
            occurred_at: ce.occurred_at as string,
            job_name: (ce.jobs as any)?.name ?? t("mapPage.unknownJob"),
          });
        }
      }
      setWorkers(Array.from(latestByWorker.values()));

      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, name, code, site_lat, site_lng, geofence_radius_m")
        .in("status", ["active", "in_progress"])
        .not("site_lat", "is", null)
        .not("site_lng", "is", null);
      setJobSites((jobs as JobSite[]) ?? []);
    } catch {
      // Data load error — non-fatal, map still shows
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load MapTiler SDK (MapLibre-based, free)
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.maptiler.com/maptiler-sdk-js/v2.3.0/maptiler-sdk.umd.min.js";
    script.onerror = () => {
      setMapError(t("mapPage.failedToLoadLibrary"));
      setLoading(false);
    };
    script.onload = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.maptiler.com/maptiler-sdk-js/v2.3.0/maptiler-sdk.css";
      document.head.appendChild(link);
      setMapReady(true);
    };
    document.head.appendChild(script);
  }, [t]);

  // Init map with error handling
  useEffect(() => {
    if (!mapReady || !mapContainer.current || mapRef.current) return;

    try {
      const maptiler = (window as any).maptilersdk;
      if (!maptiler) {
        setMapError(t("mapPage.sdkUnavailable"));
        return;
      }

      maptiler.config.apiKey = MAPTILER_KEY;

      const map = new maptiler.Map({
        container: mapContainer.current,
        style: maptiler.MapStyle.STREETS,
        center: [-71.0589, 42.3601],
        zoom: 11,
      });

      map.on("error", (e: any) => {
        console.error("Map error:", e);
      });

      mapRef.current = map;
      loadData();
    } catch (e) {
      setMapError(`Map initialization failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapReady, loadData, t]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mapError) return;

    try {
      const mt = (window as any).maptilersdk;

      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      for (const site of jobSites) {
        const el = document.createElement("div");
        el.style.cssText = "width:32px;height:32px;background:#F38B2A;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;";
        el.title = `${site.name} (${site.code})`;

        const marker = new mt.Marker({ element: el })
          .setLngLat([site.site_lng, site.site_lat])
          .setPopup(new mt.Popup({ offset: 20 }).setHTML(
            `<div style="font-family:system-ui;padding:4px"><strong>${site.name}</strong><br/><span style="color:#64748B;font-size:12px">${site.code} · ${site.geofence_radius_m}m geofence</span></div>`,
          ))
          .addTo(map);
        markersRef.current.push(marker);
      }

      for (const w of workers) {
        const isClockedIn = w.event_subtype === "clock_in";
        const color = isClockedIn ? "#16A34A" : "#94A3B8";

        const el = document.createElement("div");
        el.style.cssText = `width:28px;height:28px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;`;
        el.title = `${w.full_name} — ${isClockedIn ? t("mapPage.clockedInTitle") : t("mapPage.clockedOutTitle")}`;

        const marker = new mt.Marker({ element: el })
          .setLngLat([w.gps_lng, w.gps_lat])
          .setPopup(new mt.Popup({ offset: 16 }).setHTML(
            `<div style="font-family:system-ui;padding:4px"><strong>${w.full_name}</strong><br/><span style="color:${color};font-weight:600">${isClockedIn ? `● ${t("mapPage.clockedInTitle")}` : `○ ${t("mapPage.clockedOutTitle")}`}</span><br/><span style="color:#64748B;font-size:12px">${w.job_name}<br/>${new Date(w.occurred_at).toLocaleTimeString()}</span></div>`,
          ))
          .addTo(map);
        markersRef.current.push(marker);
      }

      const allCoords = [
        ...workers.map((w) => [w.gps_lng, w.gps_lat]),
        ...jobSites.map((s) => [s.site_lng, s.site_lat]),
      ];
      if (allCoords.length > 1) {
        const bounds = new mt.LngLatBounds();
        for (const c of allCoords) bounds.extend(c);
        map.fitBounds(bounds, { padding: 60 });
      } else if (allCoords.length === 1) {
        map.setCenter(allCoords[0]);
        map.setZoom(14);
      }
    } catch {
      // Marker error — non-fatal
    }
  }, [workers, jobSites, mapReady, mapError, t]);

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel("map-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "clock_events",
        },
        () => loadData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
        },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const clockedIn = workers.filter((w) => w.event_subtype === "clock_in").length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("mapPage.title")}</h1>
          <p className="mt-0.5 text-sm text-slate-400">{t("mapPage.subtitle")}</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-slate-500">{t("mapPage.in", { count: clockedIn })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span className="text-slate-500">{t("mapPage.out", { count: workers.length - clockedIn })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-500">{t("mapPage.sites", { count: jobSites.length })}</span>
          </div>
        </div>
      </div>

      {/* Map error fallback */}
      {mapError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <div className="text-3xl text-red-300">🗺️</div>
          <h3 className="mt-3 font-bold text-red-800">{t("mapPage.mapUnavailable")}</h3>
          <p className="mt-1 text-sm text-red-600">{mapError}</p>
          <p className="mt-3 text-xs text-red-400">
            {t("mapPage.getFreeKeyAt")}{" "}
            <a
              href="https://cloud.maptiler.com/account/keys/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              cloud.maptiler.com
            </a>{" "}
            {t("mapPage.addItToEnv")}{" "}
            <code className="rounded bg-red-100 px-1 py-0.5">
              .env.local
            </code>{" "}
            {t("mapPage.asEnvKey")} <code className="rounded bg-red-100 px-1 py-0.5">NEXT_PUBLIC_MAPTILER_KEY</code>
          </p>

          {/* Fallback: show worker data as table */}
          {workers.length > 0 && (
            <div className="mx-auto mt-6 max-w-lg text-left">
              <p className="mb-2 text-xs font-semibold text-slate-500">
                {t("mapPage.workerPositions")}
              </p>
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-stone-50 text-left text-slate-400">
                      <th className="px-3 py-2">{t("mapPage.worker")}</th>
                      <th className="px-3 py-2">{t("mapPage.status")}</th>
                      <th className="px-3 py-2">{t("mapPage.job")}</th>
                      <th className="px-3 py-2">{t("mapPage.gps")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w) => (
                      <tr key={w.user_id} className="border-b border-stone-50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {w.full_name}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              w.event_subtype === "clock_in"
                                ? "text-green-600"
                                : "text-slate-400"
                            }
                          >
                            {w.event_subtype === "clock_in"
                              ? `● ${t("mapPage.clockedInTitle")}`
                              : `○ ${t("mapPage.clockedOutTitle")}`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{w.job_name}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {w.gps_lat.toFixed(4)}, {w.gps_lng.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && !mapError && (
        <div className="flex h-96 items-center justify-center text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-slate-900" />
          <span className="ml-3 text-sm">{t("mapPage.loadingMap")}</span>
        </div>
      )}

      {!mapError && (
        <div
          ref={mapContainer}
          className="h-[600px] w-full rounded-2xl border border-stone-200 shadow-sm"
          style={{ minHeight: "500px" }}
        />
      )}
    </div>
  );
}
