-- Seed Data for Local Development
-- This ensures the DB is never empty during local testing.

INSERT INTO companies (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Co', 'testco')
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fieldops-media',
    'fieldops-media',
    false,
    20971520,
    ARRAY['image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    updated_at = now();

-- Note: In a real system, users are attached to auth.users. 
-- For local Edge Function testing with real JWTs, we will insert a mock auth.user and a public.user.
-- Supabase local uses standard auth.users schema. 

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'worker@test.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'worker2@test.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'supervisor@test.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, company_id, role, full_name, email)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'worker', 'Test Worker', 'worker@test.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, company_id, role, full_name, email)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'worker', 'Second Worker', 'worker2@test.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, company_id, role, full_name, email)
VALUES ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'supervisor', 'Test Supervisor', 'supervisor@test.com')
ON CONFLICT DO NOTHING;

INSERT INTO jobs (id, company_id, name, code, created_by)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Test Job',
    'JOB-1',
    '66666666-6666-6666-6666-666666666666'
)
ON CONFLICT DO NOTHING;

INSERT INTO jobs (id, company_id, name, code, created_by, site_lat, site_lng, geofence_radius_m)
VALUES (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    'Second Test Job',
    'JOB-2',
    '66666666-6666-6666-6666-666666666666',
    40.7128,
    -74.0060,
    150
)
ON CONFLICT DO NOTHING;

UPDATE jobs
SET
    site_lat = 37.7749,
    site_lng = -122.4194,
    geofence_radius_m = 150
WHERE id = '33333333-3333-3333-3333-333333333333';

INSERT INTO assignments (id, company_id, job_id, user_id, assigned_role, assigned_by)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'worker', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

INSERT INTO assignments (id, company_id, job_id, user_id, assigned_role, assigned_by)
VALUES ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'worker', '66666666-6666-6666-6666-666666666666')
ON CONFLICT DO NOTHING;

INSERT INTO assignments (id, company_id, job_id, user_id, assigned_role, assigned_by)
VALUES ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', 'supervisor', '66666666-6666-6666-6666-666666666666')
ON CONFLICT DO NOTHING;

INSERT INTO assignments (id, company_id, job_id, user_id, assigned_role, assigned_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 'supervisor', '66666666-6666-6666-6666-666666666666')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, company_id, job_id, name, requires_photo, assigned_to)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'Checkpoint Photo',
    true,
    '22222222-2222-2222-2222-222222222222'
)
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, company_id, job_id, name, requires_photo, assigned_to)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    '77777777-7777-7777-7777-777777777777',
    'Second Job Task',
    false,
    '55555555-5555-5555-5555-555555555555'
)
ON CONFLICT DO NOTHING;

-- ─── Company B (RLS isolation test partner) ─────────────────

INSERT INTO companies (id, name, slug)
VALUES ('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'Rival Corp', 'rivalcorp')
ON CONFLICT DO NOTHING;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
    'authenticated', 'authenticated', 'worker@rival.com', crypt('password123', gen_salt('bf')),
    now(), null, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, company_id, role, full_name, email)
VALUES ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'worker', 'Rival Worker', 'worker@rival.com')
ON CONFLICT DO NOTHING;

INSERT INTO jobs (id, company_id, name, code, created_by)
VALUES (
    'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
    'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0',
    'Rival Job',
    'RIVAL-1',
    'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1'
)
ON CONFLICT DO NOTHING;

INSERT INTO assignments (id, company_id, job_id, user_id, assigned_role, assigned_by)
VALUES ('b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'worker', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, company_id, job_id, name, requires_photo, assigned_to)
VALUES (
    'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4',
    'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0',
    'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
    'Rival Task',
    false,
    'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1'
)
ON CONFLICT DO NOTHING;
