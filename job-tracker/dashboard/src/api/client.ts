import axios from 'axios';
import type {
  Profile,
  Job,
  JobFilters,
  CreateJobPayload,
  UpdateJobPayload,
  AnalyticsSummary,
  TimelinePoint,
  LocationPoint,
  SalaryStats,
  SourcePoint,
  WorkTypePoint,
} from '../types';

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000' });

export const api = {
  // ── Profiles ──────────────────────────────────────────────
  getProfiles: () =>
    http.get<Profile[]>('/profiles').then((r) => r.data),

  createProfile: (data: { name: string; color: string }) =>
    http.post<Profile>('/profiles', data).then((r) => r.data),

  updateProfile: (id: number, data: { name?: string; color?: string }) =>
    http.put<Profile>(`/profiles/${id}`, data).then((r) => r.data),

  deleteProfile: (id: number) =>
    http.delete(`/profiles/${id}`),

  // ── Jobs ──────────────────────────────────────────────────
  getJobs: (profileId: number, filters?: JobFilters) =>
    http
      .get<Job[]>('/jobs', {
        params: { profile_id: profileId, ...filters },
      })
      .then((r) => r.data),

  createJob: (data: CreateJobPayload) =>
    http.post<Job>('/jobs', data).then((r) => r.data),

  getJob: (id: number) =>
    http.get<Job>(`/jobs/${id}`).then((r) => r.data),

  updateJob: (id: number, data: UpdateJobPayload) =>
    http.put<Job>(`/jobs/${id}`, data).then((r) => r.data),

  deleteJob: (id: number) =>
    http.delete(`/jobs/${id}`),

  moveJobs: (jobIds: number[], targetProfileId: number) =>
    http
      .patch('/jobs/move', { job_ids: jobIds, target_profile_id: targetProfileId })
      .then((r) => r.data),

  // ── Analytics ─────────────────────────────────────────────
  getAnalyticsSummary: (profileId: number) =>
    http
      .get<AnalyticsSummary>('/analytics/summary', { params: { profile_id: profileId } })
      .then((r) => r.data),

  getAnalyticsTimeline: (profileId: number) =>
    http
      .get<TimelinePoint[]>('/analytics/timeline', { params: { profile_id: profileId } })
      .then((r) => r.data),

  getAnalyticsLocations: (profileId: number) =>
    http
      .get<LocationPoint[]>('/analytics/locations', { params: { profile_id: profileId } })
      .then((r) => r.data),

  getAnalyticsSalary: (profileId: number) =>
    http
      .get<SalaryStats>('/analytics/salary', { params: { profile_id: profileId } })
      .then((r) => r.data),

  getAnalyticsSources: (profileId: number) =>
    http
      .get<SourcePoint[]>('/analytics/sources', { params: { profile_id: profileId } })
      .then((r) => r.data),

  getAnalyticsWorkTypes: (profileId: number) =>
    http
      .get<WorkTypePoint[]>('/analytics/work-types', { params: { profile_id: profileId } })
      .then((r) => r.data),

  // ── Export / Import ───────────────────────────────────────
  exportCsv: (profileId: number) =>
    http
      .get('/export/csv', { params: { profile_id: profileId }, responseType: 'blob' })
      .then((r) => r.data as Blob),

  exportJson: (profileId: number) =>
    http
      .get('/export/json', { params: { profile_id: profileId }, responseType: 'blob' })
      .then((r) => r.data as Blob),

  importJson: (profileId: number, jobs: unknown[]) =>
    http.post('/import/json', { profile_id: profileId, jobs }).then((r) => r.data),

  // ── Health ────────────────────────────────────────────────
  ping: () =>
    http.get('/profiles').then(() => true).catch(() => false) as Promise<boolean>,
};
