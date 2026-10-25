export interface TimelineEvent {
  id: string;
  company_id: string;
  job_id: string;
  user_id: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface JobSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  site_name: string | null;
  geofence_radius_m: number;
  active_worker_count?: number;
  last_activity_at?: string;
}

export interface WorkerStatus {
  user_id: string;
  full_name: string;
  role: string;
  is_clocked_in: boolean;
  active_job_name: string | null;
  last_clock_event_at: string | null;
  photo_count_today: number;
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  payment_status: string;
  industry: string | null;
  logo_url: string | null;
  created_at: string;
  active_user_count: number;
  total_user_count: number;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface CompanyUser {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface CompanyDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  payment_status: string;
  industry: string | null;
  logo_url: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

