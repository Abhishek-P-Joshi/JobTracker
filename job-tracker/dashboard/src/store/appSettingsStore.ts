import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppSettingsStore {
  shortcutsEnabled: boolean;
  toggleShortcuts: () => void;
}

export const useAppSettingsStore = create<AppSettingsStore>()(
  persist(
    (set) => ({
      shortcutsEnabled: true,
      toggleShortcuts: () => set((s) => ({ shortcutsEnabled: !s.shortcutsEnabled })),
    }),
    { name: 'jobtrack_app_settings' }
  )
);
