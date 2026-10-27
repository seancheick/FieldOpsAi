-- ========================================================
-- Migration: 20260421900000_fix_disk_io_and_cron_retention
-- Purpose:   Resolve Disk IO budget depletion on Supabase compute.
--
-- ROOT CAUSE (audited 2026-10-26):
--   1. An aggressive cron job 'job-worker' was running every 2 minutes
--      (*/2 * * * *) calling /functions/v1/job_worker via net.http_post.
--      This fired 720 times/day (21,600 times/month) 24/7 despite
--      public.background_jobs having 0 rows.
--   2. Each invocation generated:
--      - 1 insert + 3 updates in cron.job_run_details (accumulated 148,192 rows, 71 MB)
--      - 1 insert + 1 delete in net.http_request_queue (autovacuumed 2,639 times)
--      - 1 insert into net._http_response (bloated to 134 MB)
--      - Background cleanup 'DELETE FROM net._http_response' took 52.9 hours of CPU
--        constantly scanning bloated dead pages.
--      - Constant WAL writes, dirty block flushes, and autovacuum cycles
--        completely exhausted the Supabase Disk IO budget even with 0 app users.
--
-- FIX:
--   1. Unschedule 'job-worker' from pg_cron.
--   2. Schedule 'cleanup-cron-history' daily at 03:00 UTC to purge
--      cron.job_run_details older than 3 days, preventing unbounded bloat.
--   3. Truncate net._http_response and purge old cron.job_run_details
--      reclaiming ~205 MB of bloated table space back to 48 kB.
-- ========================================================

-- 1. Unschedule the aggressive 2-minute poller if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-worker') THEN
    PERFORM cron.unschedule('job-worker');
  END IF;
END
$$;

-- 2. Add retention policy for pg_cron run history (runs daily at 3:00 AM UTC, retains 3 days)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-history') THEN
    PERFORM cron.unschedule('cleanup-cron-history');
  END IF;
END
$$;

SELECT cron.schedule(
  'cleanup-cron-history',
  '0 3 * * *',
  $cron$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days' $cron$
);

-- 3. Clean up bloated log tables
TRUNCATE TABLE net._http_response;
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days';
