import { useProfileStore } from '../store/profileStore';

export function useProfile() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const setActiveProfileId = useProfileStore((s) => s.setActiveProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  return { activeProfile, profiles, activeProfileId, setActiveProfileId };
}
