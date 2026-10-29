/** TypeScript mirrors of the backend's JSON payloads. */

export type Status = "applied" | "phone_screen" | "interview" | "offer" | "rejected" | "withdrawn";
export type Source = "linkedin" | "indeed" | "company_site" | "referral" | "other";
export type EventType = "status_change" | "note";

export interface ApplicationEvent {
  id: number;
  event_type: EventType;
  from_status: Status | null;
  to_status: Status | null;
  note: string;
  created_at: string;
}

export interface Application {
  id: number;
  company: string;
  job_title: string;
  source: Source;
  link: string;
  date_applied: string;
  location: string;
  salary_range: string;
  contact_person: string;
  resume_version: number | null;
  resume_version_name: string | null;
  current_status: Status;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDetail extends Application {
  events: ApplicationEvent[];
}

export type ApplicationInput = Pick<
  Application,
  | "company"
  | "job_title"
  | "source"
  | "link"
  | "date_applied"
  | "location"
  | "salary_range"
  | "contact_person"
  | "resume_version"
>;

export type NewEvent =
  | { event_type: "note"; note: string }
  | { event_type: "status_change"; to_status: Status; note: string };

export interface ResumeVersion {
  id: number;
  name: string;
  description: string;
  original_filename: string;
  application_count: number;
  created_at: string;
}

export interface StageStat {
  stage: Status;
  label: string;
  count: number;
  percent: number;
}

export interface Funnel {
  total: number;
  stages: StageStat[];
}

export interface WeekStat {
  week_start: string;
  count: number;
}

export interface PipelineStat {
  status: Status;
  label: string;
  count: number;
}

export interface ResumePerformance extends Funnel {
  resume_version_id: number | null;
  name: string;
}

export interface DashboardStats {
  pipeline: PipelineStat[];
  funnel: Funnel;
  per_week: WeekStat[];
  resume_performance: ResumePerformance[];
}

export interface AuthResponse {
  token: string;
  username: string;
}
