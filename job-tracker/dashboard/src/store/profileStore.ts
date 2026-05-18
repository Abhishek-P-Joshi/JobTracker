import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '../types';
import { api } from '../api/client';

interface ProfileStore {
  profiles: Profile[];
  activeProfileId: number | null;
  isLoading: boolean;
  setActiveProfileId: (id: number) => void;
  loadProfiles: () => Promise<void>;
  addProfile: (p: Profile) => void;
  updateProfile: (p: Profile) => void;
  removeProfile: (id: number) => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      isLoading: false,

      setActiveProfileId: (id) => set({ activeProfileId: id }),

      loadProfiles: async () => {
        set({ isLoading: true });
        try {
          const profiles = await api.getProfiles();
          set({ profiles });
          const { activeProfileId } = get();
          if (!profiles.find((p) => p.id === activeProfileId) && profiles.length > 0) {
            set({ activeProfileId: profiles[0].id });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      addProfile: (p) => set((s) => ({ profiles: [...s.profiles, p] })),

      updateProfile: (p) =>
        set((s) => ({ profiles: s.profiles.map((x) => (x.id === p.id ? p : x)) })),

      removeProfile: (id) =>
        set((s) => {
          const profiles = s.profiles.filter((p) => p.id !== id);
          const activeProfileId =
            s.activeProfileId === id
              ? (profiles[0]?.id ?? null)
              : s.activeProfileId;
          return { profiles, activeProfileId };
        }),
    }),
    {
      name: 'jobtrack_active_profile_id',
      partialize: (s) => ({ activeProfileId: s.activeProfileId }),
    }
  )
);
