import { useState, useRef, useEffect } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useProfile } from '../hooks/useProfile';
import { api } from '../api/client';

export default function ProfileSwitcher() {
  const { profiles, activeProfileId, setActiveProfileId, activeProfile } = useProfile();
  const addProfile = useProfileStore((s) => s.addProfile);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const profile = await api.createProfile({ name: newName.trim(), color: newColor });
      addProfile(profile);
      setActiveProfileId(profile.id);
      setNewName('');
      setCreating(false);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-gray-800 transition-colors text-left"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: activeProfile?.color ?? '#6b7280' }}
        />
        <span className="text-sm text-gray-200 truncate flex-1">
          {activeProfile?.name ?? 'No profile'}
        </span>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-1 max-h-52 overflow-y-auto">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProfileId(p.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors text-left ${
                  p.id === activeProfileId
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                {p.name}
                {p.id === activeProfileId && <span className="ml-auto text-brand text-xs">✓</span>}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-700 p-2">
            {creating ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Profile name"
                  className="input text-xs py-1"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <button onClick={handleCreate} disabled={saving || !newName.trim()} className="btn-primary py-1 flex-1 text-xs">
                    {saving ? 'Creating…' : 'Create'}
                  </button>
                  <button onClick={() => setCreating(false)} className="btn-ghost py-1 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
              >
                <span className="text-base leading-none">+</span> New Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
