import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { JobFilters, UpdateJobPayload, CreateJobPayload } from '../types';

export function useJobs(profileId: number | null, filters?: JobFilters) {
  return useQuery({
    queryKey: ['jobs', profileId, filters],
    queryFn: () => api.getJobs(profileId!, filters),
    enabled: !!profileId,
    refetchInterval: 15_000,
  });
}

export function useJob(id: number | null) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => api.getJob(id!),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobPayload) => api.createJob(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateJobPayload }) =>
      api.updateJob(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job', id] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteJob(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.removeQueries({ queryKey: ['job', id] });
    },
  });
}

export function useMoveJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobIds, targetProfileId }: { jobIds: number[]; targetProfileId: number }) =>
      api.moveJobs(jobIds, targetProfileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
