"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { SkeletonPhotoGrid } from "@/components/ui/skeleton";

interface PhotoEntry {
  id: string;
  occurred_at: string;
  media_asset_id: string;
  is_checkpoint: boolean;
  user_id: string;
  users: { full_name: string } | null;
  task_id: string | null;
  tasks: { name: string } | null;
  media_assets: {
    id: string;
    verification_code: string | null;
    storage_path: string;
    bucket_name: string;
    sha256_hash: string | null;
    kind: string;
    stamped_media_id: string | null;
    metadata: Record<string, unknown>;
  } | null;
}

type DisplayAsset = NonNullable<PhotoEntry["media_assets"]>;
type ResolvedPhotoEntry = PhotoEntry & {
  displayAsset: DisplayAsset | null;
};

function buildSignedUrlCacheKey(photoId: string, asset: DisplayAsset | null) {
  return `${photoId}:${asset?.bucket_name ?? ""}:${asset?.storage_path ?? ""}`;
}

function getDisplayAsset(
  photo: PhotoEntry,
  stampedAssetsById: Map<string, DisplayAsset>,
): DisplayAsset | null {
  const originalAsset = photo.media_assets;
  if (!originalAsset) return null;

  if (originalAsset.stamped_media_id) {
    return stampedAssetsById.get(originalAsset.stamped_media_id) ?? originalAsset;
  }

  return originalAsset;
}

export default function PhotosPage() {
  return (
    <Suspense
      fallback={
        <SkeletonPhotoGrid count={6} />
      }
    >
      <PhotoFeedContent />
    </Suspense>
  );
}

function PhotoFeedContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const activeTab = (searchParams.get("tab") || "feed").toLowerCase();

  const PHOTOS_PAGE_SIZE = 30;

  const [photos, setPhotos] = useState<ResolvedPhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const urlCacheRef = useRef<Record<string, string>>({});
  const [hasMorePhotos, setHasMorePhotos] = useState(false);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);

  // Filter state
  const [filterDate, setFilterDate] = useState("");
  const [filterWorker, setFilterWorker] = useState("");
  const [filterTask, setFilterTask] = useState("");
  const [filterMode, setFilterMode] = useState("");

  // Lightbox state
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  // Bulk select state
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [codeCopied, setCodeCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!jobId) {
      setError("no_job");
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabase();

      const { data: job } = await supabase
        .from("jobs")
        .select("name")
        .eq("id", jobId)
        .maybeSingle();
      if (job) setJobName(job.name);

      const { data, error: err } = await supabase
        .from("photo_events")
        .select(`
          id,
          occurred_at,
          media_asset_id,
          is_checkpoint,
          user_id,
          task_id,
          users!photo_events_user_id_fkey ( full_name ),
          tasks ( name ),
          media_assets!photo_events_media_asset_id_fkey (
            id,
            verification_code,
            storage_path,
            bucket_name,
            sha256_hash,
            kind,
            stamped_media_id,
            metadata
          )
        `)
        .eq("job_id", jobId)
        .order("occurred_at", { ascending: false })
        .limit(PHOTOS_PAGE_SIZE);

      if (err) throw err;
      const photoData = (data as unknown as PhotoEntry[]) ?? [];
      setHasMorePhotos(photoData.length === PHOTOS_PAGE_SIZE);

      const stampedIds = photoData
        .map((photo) => photo.media_assets?.stamped_media_id)
        .filter((id): id is string => Boolean(id));

      let stampedAssetsById = new Map<string, DisplayAsset>();
      if (stampedIds.length > 0) {
        const { data: stampedAssets, error: stampedErr } = await supabase
          .from("media_assets")
          .select(`
            id,
            verification_code,
            storage_path,
            bucket_name,
            sha256_hash,
            kind,
            stamped_media_id,
            metadata
          `)
          .in("id", stampedIds);

        if (stampedErr) throw stampedErr;

        stampedAssetsById = new Map(
          ((stampedAssets as DisplayAsset[] | null) ?? []).map((asset) => [asset.id, asset]),
        );
      }

      const resolvedPhotos = photoData.map((photo) => ({
        ...photo,
        displayAsset: getDisplayAsset(photo, stampedAssetsById),
      }));
      setPhotos(resolvedPhotos);

      // Generate signed URLs only for display assets not already cached.
      const nextSignedUrls: Record<string, string> = {};
      const newPhotos = resolvedPhotos.filter((photo) => {
        const cacheKey = buildSignedUrlCacheKey(photo.id, photo.displayAsset);
        return !urlCacheRef.current[cacheKey];
      });
      await Promise.allSettled(
        newPhotos.map(async (photo) => {
          const asset = photo.displayAsset;
          if (!asset?.storage_path || !asset?.bucket_name) return;
          const { data: urlData } = await supabase.storage
            .from(asset.bucket_name)
            .createSignedUrl(asset.storage_path, 3600);
          if (urlData?.signedUrl) {
            const cacheKey = buildSignedUrlCacheKey(photo.id, asset);
            urlCacheRef.current[cacheKey] = urlData.signedUrl;
          }
        })
      );
      resolvedPhotos.forEach((photo) => {
        const cacheKey = buildSignedUrlCacheKey(photo.id, photo.displayAsset);
        if (urlCacheRef.current[cacheKey]) {
          nextSignedUrls[photo.id] = urlCacheRef.current[cacheKey];
        }
      });
      setSignedUrls(nextSignedUrls);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("photos.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [jobId, t]);

  const loadMorePhotos = useCallback(async () => {
    if (!jobId) return;
    setLoadingMorePhotos(true);
    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from("photo_events")
        .select(`
          id,
          occurred_at,
          media_asset_id,
          is_checkpoint,
          user_id,
          task_id,
          users!photo_events_user_id_fkey ( full_name ),
          tasks ( name ),
          media_assets!photo_events_media_asset_id_fkey (
            id,
            verification_code,
            storage_path,
            bucket_name,
            sha256_hash,
            kind,
            stamped_media_id,
            metadata
          )
        `)
        .eq("job_id", jobId)
        .order("occurred_at", { ascending: false })
        .range(photos.length, photos.length + PHOTOS_PAGE_SIZE - 1);

      if (err) throw err;
      const photoData = (data as unknown as PhotoEntry[]) ?? [];
      setHasMorePhotos(photoData.length === PHOTOS_PAGE_SIZE);

      // Resolve stamped assets for new page
      const stampedIds = photoData
        .map((photo) => photo.media_assets?.stamped_media_id)
        .filter((id): id is string => Boolean(id));

      let stampedAssetsById = new Map<string, DisplayAsset>();
      if (stampedIds.length > 0) {
        const { data: stampedAssets, error: stampedErr } = await supabase
          .from("media_assets")
          .select(`
            id,
            verification_code,
            storage_path,
            bucket_name,
            sha256_hash,
            kind,
            stamped_media_id,
            metadata
          `)
          .in("id", stampedIds);

        if (stampedErr) throw stampedErr;
        stampedAssetsById = new Map(
          ((stampedAssets as DisplayAsset[] | null) ?? []).map((asset) => [asset.id, asset]),
        );
      }

      const resolvedNew = photoData.map((photo) => ({
        ...photo,
        displayAsset: getDisplayAsset(photo, stampedAssetsById),
      }));

      // Generate signed URLs for new photos
      await Promise.allSettled(
        resolvedNew.map(async (photo) => {
          const asset = photo.displayAsset;
          if (!asset?.storage_path || !asset?.bucket_name) return;
          const { data: urlData } = await supabase.storage
            .from(asset.bucket_name)
            .createSignedUrl(asset.storage_path, 3600);
          if (urlData?.signedUrl) {
            const cacheKey = buildSignedUrlCacheKey(photo.id, asset);
            urlCacheRef.current[cacheKey] = urlData.signedUrl;
          }
        })
      );

      const newSignedUrls: Record<string, string> = {};
      resolvedNew.forEach((photo) => {
        const cacheKey = buildSignedUrlCacheKey(photo.id, photo.displayAsset);
        if (urlCacheRef.current[cacheKey]) {
          newSignedUrls[photo.id] = urlCacheRef.current[cacheKey];
        }
      });

      setPhotos((prev) => [...prev, ...resolvedNew]);
      setSignedUrls((prev) => ({ ...prev, ...newSignedUrls }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("photos.failedToLoad"));
    } finally {
      setLoadingMorePhotos(false);
    }
  }, [jobId, photos.length, t]);

  useEffect(() => {
    if (!jobId) return;

    loadPhotos();

    const supabase = getSupabase();
    const channel = supabase
      .channel(`photos-job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photo_events",
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          loadPhotos();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media_assets",
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          loadPhotos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, loadPhotos]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  // Stats derived from all photos
  const stats = useMemo(() => {
    let verified = 0;
    let unverified = 0;
    let checkpoints = 0;
    let beforeCount = 0;
    let afterCount = 0;
    for (const p of photos) {
      const asset = p.displayAsset ?? p.media_assets;
      const code = asset?.verification_code ?? p.media_assets?.verification_code;
      const hash = asset?.sha256_hash ?? p.media_assets?.sha256_hash;
      if (code || hash) verified++;
      else unverified++;
      if (p.is_checkpoint) checkpoints++;
      const meta = asset?.metadata as Record<string, unknown> | undefined;
      const mode = ((meta?.mode as string) ?? "").toLowerCase();
      if (mode === "before") beforeCount++;
      else if (mode === "after") afterCount++;
    }
    return { total: photos.length, verified, unverified, checkpoints, beforeCount, afterCount };
  }, [photos]);

  // Derive unique workers and tasks for filter dropdowns
  const uniqueWorkers = useMemo(() => {
    const names = new Set<string>();
    photos.forEach((p) => {
      const name = (p.users as { full_name: string } | null)?.full_name;
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [photos]);

  const uniqueTasks = useMemo(() => {
    const names = new Set<string>();
    photos.forEach((p) => {
      const name = (p.tasks as { name: string } | null)?.name;
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [photos]);

  // Apply filters
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Date filter
      if (filterDate) {
        const photoDate = new Date(photo.occurred_at).toISOString().slice(0, 10);
        if (photoDate !== filterDate) return false;
      }
      // Worker filter
      if (filterWorker) {
        const name = (photo.users as { full_name: string } | null)?.full_name ?? "";
        if (name !== filterWorker) return false;
      }
      // Task filter
      if (filterTask) {
        const name = (photo.tasks as { name: string } | null)?.name ?? "";
        if (name !== filterTask) return false;
      }
      // Mode filter (Before/After/Standard)
      if (filterMode) {
        const asset = photo.displayAsset ?? photo.media_assets;
        const meta = asset?.metadata as Record<string, unknown> | undefined;
        const mode = (meta?.mode as string) ?? "standard";
        if (mode.toLowerCase() !== filterMode.toLowerCase()) return false;
      }
      return true;
    });
  }, [photos, filterDate, filterWorker, filterTask, filterMode]);

  // Bulk selection helpers
  function togglePhotoSelection(id: string) {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedPhotos.size === filteredPhotos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(filteredPhotos.map((p) => p.id)));
    }
  }

  function downloadSelected() {
    filteredPhotos.forEach((photo) => {
      if (selectedPhotos.has(photo.id) && signedUrls[photo.id]) {
        window.open(signedUrls[photo.id], "_blank");
      }
    });
  }

  // Lightbox helpers
  function openLightbox(index: number) {
    setSelectedPhotoIndex(index);
    setCodeCopied(false);
  }
  function closeLightbox() {
    setSelectedPhotoIndex(null);
    setCodeCopied(false);
  }
  function goToPrevPhoto() {
    setSelectedPhotoIndex((i) => (i !== null && i > 0 ? i - 1 : i));
    setCodeCopied(false);
  }
  function goToNextPhoto() {
    setSelectedPhotoIndex((i) =>
      i !== null && i < filteredPhotos.length - 1 ? i + 1 : i,
    );
    setCodeCopied(false);
  }

  async function copyVerificationCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // fallback — ignore
    }
  }

  /** Export Proof Pack — generates a JSON manifest + opens download links for selected photos */
  async function exportProofPack() {
    if (selectedPhotos.size === 0) return;
    setExporting(true);
    try {
      const selected = filteredPhotos.filter((p) => selectedPhotos.has(p.id));
      const manifest = {
        export_type: "FieldOps Proof Pack",
        exported_at: new Date().toISOString(),
        job_id: jobId,
        job_name: jobName,
        total_photos: selected.length,
        photos: selected.map((p) => {
          const asset = p.displayAsset ?? p.media_assets;
          const originalAsset = p.media_assets;
          return {
            id: p.id,
            captured_at: p.occurred_at,
            worker: (p.users as { full_name: string } | null)?.full_name ?? "Unknown",
            task: (p.tasks as { name: string } | null)?.name ?? null,
            is_checkpoint: p.is_checkpoint,
            verification_code: asset?.verification_code ?? originalAsset?.verification_code ?? null,
            sha256_hash: asset?.sha256_hash ?? originalAsset?.sha256_hash ?? null,
            mode: ((asset?.metadata as Record<string, unknown>)?.mode as string) ?? "standard",
          };
        }),
      };
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proof-pack-${jobName ?? jobId ?? "export"}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Also open the photo downloads
      selected.forEach((photo) => {
        if (signedUrls[photo.id]) {
          window.open(signedUrls[photo.id], "_blank");
        }
      });
    } finally {
      setExporting(false);
    }
  }

  const lightboxPhoto = selectedPhotoIndex !== null ? filteredPhotos[selectedPhotoIndex] : null;

  return (
    <div>
      <div className="mb-6">
        <a
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> {t("common.backToDashboard")}
        </a>
        <h2 className="text-2xl font-bold text-slate-900">
          {jobName ? t("photos.titleWithJob", { jobName }) : t("photos.title")}
        </h2>
        <p className="mt-1 text-slate-600">{t("photos.subtitle")}</p>
        {photos.length > 0 && (
          <p className="mt-1 text-sm text-slate-400">
            {t("photos.liveUpdates", { count: photos.length })}
          </p>
        )}

        {/* Sub-tabs (job-scoped) */}
        {jobId && (
          <div className="mt-4 flex gap-1 rounded-xl bg-stone-100 p-1">
            <a
              href={`/photos?job_id=${encodeURIComponent(jobId)}&tab=feed`}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-all ${
                activeTab === "feed"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Feed
            </a>
            <a
              href={`/timeline?job_id=${encodeURIComponent(jobId)}`}
              className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold text-slate-400 transition-all hover:text-slate-600"
            >
              Timeline
            </a>
            <a
              href={`/map?job_id=${encodeURIComponent(jobId)}`}
              className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold text-slate-400 transition-all hover:text-slate-600"
            >
              Map
            </a>
          </div>
        )}

        {/* Stats summary bar */}
        {!loading && !error && photos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Total Photos</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{stats.verified}</p>
              <p className="text-xs text-emerald-600">Verified</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.unverified}</p>
              <p className="text-xs text-amber-600">Pending</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{stats.checkpoints}</p>
              <p className="text-xs text-blue-600">Checkpoints</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-violet-700">{stats.beforeCount}</p>
              <p className="text-xs text-violet-600">Before</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-rose-700">{stats.afterCount}</p>
              <p className="text-xs text-rose-600">After</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      {photos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
          {/* Date */}
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            {t("photos.filterByDate")}
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-lg border border-stone-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>

          {/* Worker */}
          <select
            value={filterWorker}
            onChange={(e) => setFilterWorker(e.target.value)}
            className="rounded-lg border border-stone-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">{t("photos.allWorkers")}</option>
            {uniqueWorkers.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {/* Task */}
          <select
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            className="rounded-lg border border-stone-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">{t("photos.allTasks")}</option>
            {uniqueTasks.map((tk) => (
              <option key={tk} value={tk}>{tk}</option>
            ))}
          </select>

          {/* Mode (Before/After) */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="rounded-lg border border-stone-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">{t("photos.allModes")}</option>
            <option value="before">{t("photos.before")}</option>
            <option value="after">{t("photos.after")}</option>
            <option value="standard">{t("photos.standard")}</option>
          </select>

          {/* Select All + Bulk Download */}
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filteredPhotos.length > 0 && selectedPhotos.size === filteredPhotos.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-stone-300 text-amber-500 focus:ring-amber-400"
              />
              {t("photos.selectAll")}
            </label>
            {selectedPhotos.size > 0 && (
              <>
                <button
                  onClick={downloadSelected}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  {t("photos.downloadSelected")} ({selectedPhotos.size})
                </button>
                <button
                  onClick={exportProofPack}
                  disabled={exporting}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? "Exporting..." : `Export Proof Pack (${selectedPhotos.size})`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {error === "no_job" && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-slate-500">{t("photos.noJob")}</p>
          <a
            href="/"
            className="mt-4 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            {t("timeline.goToDashboard")}
          </a>
        </div>
      )}

      {error && error !== "no_job" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            onClick={loadPhotos}
            className="ml-3 font-semibold underline"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {loading && (
        <SkeletonPhotoGrid count={6} />
      )}

      {!loading && !error && photos.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
          {t("photos.noPhotos")}
        </div>
      )}

      {/* Masonry photo grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
        {filteredPhotos.map((photo, index) => {
          const workerName =
            (photo.users as { full_name: string } | null)?.full_name ??
            t("photos.unknownWorker");
          const taskName =
            (photo.tasks as { name: string } | null)?.name ?? null;
          const originalAsset = photo.media_assets as PhotoEntry["media_assets"];
          const asset = photo.displayAsset ?? originalAsset;
          const verificationCode = asset?.verification_code ?? originalAsset?.verification_code;
          const sha256 = asset?.sha256_hash ?? originalAsset?.sha256_hash;
          const isVerified = !!(verificationCode || sha256);
          const meta = asset?.metadata as Record<string, unknown> | undefined;
          const photoMode = ((meta?.mode as string) ?? "").toLowerCase();
          const stampData =
            ((asset?.metadata as Record<string, Record<string, unknown>>)?.proof_stamp) ??
            ((originalAsset?.metadata as Record<string, Record<string, unknown>>)?.proof_stamp);
          const stampLines = (stampData?.lines as string[]) ?? [];

          return (
            <div
              key={photo.id}
              className={`break-inside-avoid mb-4 overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${
                isVerified
                  ? "border-emerald-200 bg-white"
                  : "border-stone-200 bg-white"
              }`}
            >
              {/* Photo with stamp overlay */}
              <div
                className="relative bg-slate-100 cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                {/* Bulk select checkbox */}
                <div
                  className="absolute left-2 top-2 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedPhotos.has(photo.id)}
                    onChange={() => togglePhotoSelection(photo.id)}
                    className="h-4 w-4 rounded border-stone-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                </div>

                {signedUrls[photo.id] ? (
                  <img
                    src={signedUrls[photo.id]}
                    alt={`${t("photos.captured")}: ${workerName}`}
                    className="w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-4xl">
                    📸
                  </div>
                )}
                {/* Stamp overlay */}
                {stampLines.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/65 px-3 py-2 text-[10px] leading-relaxed text-white">
                    {stampLines.map((line, i) => (
                      <div
                        key={i}
                        className={i === 0 ? "font-bold text-xs" : ""}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}

                {/* Top-right badges */}
                <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                  {(photo.is_checkpoint as boolean) && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {t("photos.checkpoint")}
                    </span>
                  )}
                  {photoMode === "before" && (
                    <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      BEFORE
                    </span>
                  )}
                  {photoMode === "after" && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      AFTER
                    </span>
                  )}
                </div>
              </div>

              {/* Photo info */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    {workerName}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatTime(photo.occurred_at)}
                  </span>
                </div>
                {taskName && (
                  <p className="mt-1 text-sm text-slate-500">
                    {t("photos.task", { taskName })}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      Pending
                    </span>
                  )}
                  {verificationCode && (
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                      {verificationCode as string}
                    </code>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {hasMorePhotos && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMorePhotos}
            disabled={loadingMorePhotos}
            className="mx-auto flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-stone-50 disabled:opacity-50"
          >
            {loadingMorePhotos ? t("common.loadingMore") : t("common.loadMore")}
          </button>
        </div>
      )}

      {/* Lightbox modal */}
      {lightboxPhoto && selectedPhotoIndex !== null && (() => {
        const lbWorker =
          (lightboxPhoto.users as { full_name: string } | null)?.full_name ??
          t("photos.unknownWorker");
        const lbTask =
          (lightboxPhoto.tasks as { name: string } | null)?.name ?? null;
        const lbOriginalAsset = lightboxPhoto.media_assets as PhotoEntry["media_assets"];
        const lbAsset = lightboxPhoto.displayAsset ?? lbOriginalAsset;
        const lbVerificationCode = lbAsset?.verification_code ?? lbOriginalAsset?.verification_code;
        const lbSha256 = lbAsset?.sha256_hash ?? lbOriginalAsset?.sha256_hash;
        const lbIsVerified = !!(lbVerificationCode || lbSha256);
        const lbMeta = lbAsset?.metadata as Record<string, unknown> | undefined;
        const lbMode = ((lbMeta?.mode as string) ?? "").toLowerCase();
        const lbStampData =
          ((lbAsset?.metadata as Record<string, Record<string, unknown>>)?.proof_stamp) ??
          ((lbOriginalAsset?.metadata as Record<string, Record<string, unknown>>)?.proof_stamp);
        const lbStampLines = (lbStampData?.lines as string[]) ?? [];

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={closeLightbox}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900">
                    {t("photos.enlarged")}
                  </h3>
                  {lbIsVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Pending Verification
                    </span>
                  )}
                  {lbMode === "before" && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">Before</span>
                  )}
                  {lbMode === "after" && (
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">After</span>
                  )}
                </div>
                <button
                  onClick={closeLightbox}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={t("photos.close")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Image */}
              <div className="relative bg-slate-100">
                {/* Prev/Next arrows */}
                {selectedPhotoIndex > 0 && (
                  <button
                    onClick={goToPrevPhoto}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    aria-label={t("photos.previous")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {selectedPhotoIndex < filteredPhotos.length - 1 && (
                  <button
                    onClick={goToNextPhoto}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    aria-label={t("photos.next")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {signedUrls[lightboxPhoto.id] ? (
                  <img
                    src={signedUrls[lightboxPhoto.id]}
                    alt={`${t("photos.captured")}: ${lbWorker}`}
                    className="w-full object-contain max-h-[60vh]"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-5xl">
                    📸
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-slate-900">{lbWorker}</span>
                  <span className="text-sm text-slate-400">{formatTime(lightboxPhoto.occurred_at)}</span>
                </div>
                {lbTask && (
                  <p className="text-sm text-slate-600">
                    {t("photos.task", { taskName: lbTask })}
                  </p>
                )}
                {lbVerificationCode && (
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-slate-100 px-2 py-1 text-sm font-mono text-slate-700">
                      {lbVerificationCode as string}
                    </code>
                    <button
                      onClick={() => copyVerificationCode(lbVerificationCode as string)}
                      className="rounded-lg border border-stone-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {codeCopied ? t("photos.codeCopied") : t("photos.copyCode")}
                    </button>
                  </div>
                )}
                {/* SHA-256 integrity hash — tamper-proof evidence */}
                {lbSha256 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">Integrity Hash (SHA-256)</p>
                    <code className="block text-xs font-mono text-emerald-800 break-all">{lbSha256}</code>
                  </div>
                )}
                {lbStampLines.length > 0 && (
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                    {lbStampLines.map((line, i) => (
                      <div key={i} className={i === 0 ? "font-bold text-sm text-slate-800" : ""}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
                {lightboxPhoto.is_checkpoint && (
                  <span className="inline-block rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                    {t("photos.checkpoint")}
                  </span>
                )}
                {/* Photo counter */}
                <p className="text-xs text-slate-400 text-center pt-2">
                  {selectedPhotoIndex + 1} of {filteredPhotos.length}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
