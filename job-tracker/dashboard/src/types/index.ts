export type Status =
  | 'wishlist'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted';

export type WorkType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type SortField = 'created_at' | 'company' | 'status' | 'applied_date';

export const STATUS_ORDER: Status[] = [
  'wishlist', 'applied', 'screening', 'interview', 'offer', 'rejected', 'ghosted',
];

export const STATUS_LABELS: Record<Status, string> = {
  wishlist:  'Wishlist',
  applied:   'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer:     'Offer',
  rejected:  'Rejected',
  ghosted:   'Ghosted',
};

export const STATUS_COLORS: Record<Status, { bg: string; text: string; dot: string }> = {
  wishlist:  { bg: 'bg-gray-800',    text: 'text-gray-300',   dot: 'bg-gray-400' },
  applied:   { bg: 'bg-indigo-950',  text: 'text-indigo-300', dot: 'bg-indigo-400' },
  screening: { bg: 'bg-amber-950',   text: 'text-amber-300',  dot: 'bg-amber-400' },
  interview: { bg: 'bg-blue-950',    text: 'text-blue-300',   dot: 'bg-blue-400' },
  offer:     { bg: 'bg-green-950',   text: 'text-green-300',  dot: 'bg-green-400' },
  rejected:  { bg: 'bg-red-950',     text: 'text-red-300',    dot: 'bg-red-400' },
  ghosted:   { bg: 'bg-gray-900',    text: 'text-gray-500',   dot: 'bg-gray-600' },
};

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  remote:  'Remote',
  hybrid:  'Hybrid',
  onsite:  'On-site',
  unknown: 'Unknown',
};

export const WORK_TYPE_COLORS: Record<WorkType, string> = {
  remote:  'bg-teal-900 text-teal-300',
  hybrid:  'bg-indigo-900 text-indigo-300',
  onsite:  'bg-amber-900 text-amber-300',
  unknown: 'bg-gray-800 text-gray-400',
};

export const RECHARTS_STATUS_COLORS: Record<Status, string> = {
  wishlist:  '#6b7280',
  applied:   '#6366f1',
  screening: '#f59e0b',
  interview: '#3b82f6',
  offer:     '#10b981',
  rejected:  '#ef4444',
  ghosted:   '#4b5563',
};

export interface Profile {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  job_id: number;
  old_status: Status | null;
  new_status: Status;
  changed_at: string;
  note: string | null;
}

export interface Job {
  id: number;
  profile_id: number;
  company: string;
  title: string;
  url: string | null;
  location: string | null;
  work_type: WorkType;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  status: Status;
  source: string | null;
  applied_date: string | null;
  notes: string | null;
  job_description: string | null;
  created_at: string;
  updated_at: string;
  status_history?: StatusHistory[];
}

export interface JobFilters {
  status?: Status | '';
  work_type?: WorkType | '';
  search?: string;
  sort_by?: SortField;
  order?: 'asc' | 'desc';
}

export interface CreateJobPayload {
  profile_id: number;
  company: string;
  title: string;
  url?: string | null;
  location?: string | null;
  work_type?: WorkType;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string;
  status?: Status;
  source?: string | null;
  applied_date?: string | null;
  notes?: string | null;
  job_description?: string | null;
}

export type UpdateJobPayload = Partial<CreateJobPayload>;

export interface AnalyticsSummary {
  total: number;
  by_status: Record<Status, number>;
  response_rate: number;
}

export interface TimelinePoint {
  week: string;
  count: number;
}

export interface LocationPoint {
  location: string;
  count: number;
}

export interface SalaryStats {
  min: number | null;
  max: number | null;
  avg: number | null;
  count: number;
}

export interface SourcePoint {
  source: string;
  count: number;
}

export interface WorkTypePoint {
  work_type: WorkType;
  count: number;
}

// ── Resume Vault ──────────────────────────────────────────────────────────────

export interface ResumeConfig {
  folder_path: string | null;
  master_resume: string | null;
  default_resume: string | null;
}

export interface ResumeFile {
  filename: string;
  size_bytes: number;
  modified_at: string;
  is_master: boolean;
  is_default: boolean;
}
