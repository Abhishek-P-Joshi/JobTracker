import { useProfileStore } from '../store/profileStore';

export function useProfile() {
  const { profiles, activeProfileId, setActiveProfileId } = useProfileStore();
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  return { activeProfile, profiles, activeProfileId, setActiveProfileId };
}
