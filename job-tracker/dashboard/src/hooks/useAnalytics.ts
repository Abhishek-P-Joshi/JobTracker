import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const opts = (profileId: number | null) => ({
  enabled: !!profileId,
  staleTime: 30_000,
});

export function useAnalyticsSummary(profileId: number | null) {
  return useQuery({
    queryKey: ['analytics', 'summary', profileId],
    queryFn: () => api.getAnalyticsSummary(profileId!),
    ...opts(profileId),
  });
}

export function useAnalyticsTimeline(profileId: number | null) {
  return useQuery({
    queryKey: ['analytics', 'timeline', profileId],
    queryFn: () => api.getAnalyticsTimeline(profileId!),
    ...opts(profileId),
  });
}

export function useAnalyticsLocations(profileId: number | null) {
  return useQuery({
    queryKey: ['analytics', 'locations', profileId],
    queryFn: () => api.getAnalyticsLocations(profileId!),
    ...opts(profileId),
  });
}

export function useAnalyticsSalary(profileId: number | null) {
  return useQuery({
    queryKey: ['analytics', 'salary', profileId],
    queryFn: () => api.getAnalyticsSalary(profileId!),
    ...opts(profileId),
  });
}

export function useAnalyticsWorkTypes(profileId: number | null) {
  return useQuery({
    queryKey: ['analytics', 'work-types', profileId],
    queryFn: () => api.getAnalyticsWorkTypes(profileId!),
    ...opts(profileId),
  });
}
