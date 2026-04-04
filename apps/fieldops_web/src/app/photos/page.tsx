"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

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
    verification_code: string | null;
    storage_path: string;
    bucket_name: string;
    sha256_hash: string | null;
    kind: string;
    metadata: Record<string, unknown>;
  } | null;
}

export default function PhotosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Loading...
        </div>
      }
    >
      <PhotoFeedContent />
    </Suspense>
  );
}

function PhotoFeedContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");

  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const urlCacheRef = useRef<Record<string, string>>({});

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
            verification_code,
            storage_path,
            bucket_name,
            sha256_hash,
            kind,
            metadata
          )
        `)
        .eq("job_id", jobId)
        .order("occurred_at", { ascending: false })
        .limit(200);

      if (err) throw err;
      setPhotos((data as unknown as PhotoEntry[]) ?? []);

      // Generate signed URLs only for photos not already cached (avoids re-generating on Realtime updates)
      const photoData = (data as unknown as PhotoEntry[]) ?? [];
      const newPhotos = photoData.filter((p) => !urlCacheRef.current[p.id]);
      await Promise.allSettled(
        newPhotos.map(async (photo) => {
          const asset = photo.media_assets;
          if (!asset?.storage_path || !asset?.bucket_name) return;
          const { data: urlData } = await supabase.storage
            .from(asset.bucket_name)
            .createSignedUrl(asset.storage_path, 3600);
          if (urlData?.signedUrl) {
            urlCacheRef.current[photo.id] = urlData.signedUrl;
          }
        })
      );
      setSignedUrls({ ...urlCacheRef.current });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

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

  return (
    <div>
      <div className="mb-6">
        <a
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span>&larr;</span> Back to Dashboard
        </a>
        <h2 className="text-2xl font-bold text-slate-900">
          {jobName ? `Photo Feed: ${jobName}` : "Project Photo Feed"}
        </h2>
        <p className="mt-1 text-slate-600">
          Real-time evidence wall — all proof photos from the crew.
        </p>
        {photos.length > 0 && (
          <p className="mt-1 text-sm text-slate-400">
            {photos.length} photos · Live updates enabled
          </p>
        )}
      </div>

      {error === "no_job" && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-slate-500">
            Select a job from the dashboard to view its photo feed.
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Go to Dashboard
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
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Loading photos...
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-slate-500">
          No photos submitted yet for this job.
        </div>
      )}

      {/* Photo grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => {
          const workerName =
            (photo.users as { full_name: string } | null)?.full_name ??
            "Unknown";
          const taskName =
            (photo.tasks as { name: string } | null)?.name ?? null;
          const asset = photo.media_assets as PhotoEntry["media_assets"];
          const verificationCode = asset?.verification_code;
          const stampData = (asset?.metadata as Record<string, Record<string, unknown>>)?.proof_stamp;
          const stampLines = (stampData?.lines as string[]) ?? [];

          return (
            <div
              key={photo.id}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Photo with stamp overlay */}
              <div className="relative bg-slate-100">
                {signedUrls[photo.id] ? (
                  <img
                    src={signedUrls[photo.id]}
                    alt={`Photo by ${workerName}`}
                    className="h-48 w-full object-cover"
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
                {(photo.is_checkpoint as boolean) && (
                  <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    CHECKPOINT
                  </span>
                )}
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
                    Task: {taskName}
                  </p>
                )}
                {verificationCode && (
                  <code className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
                    {verificationCode as string}
                  </code>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
