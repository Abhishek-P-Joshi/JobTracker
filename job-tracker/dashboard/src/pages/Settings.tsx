import { useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useProfile } from '../hooks/useProfile';
import { api } from '../api/client';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { profiles, updateProfile, removeProfile, loadProfiles } = useProfileStore();
  const { activeProfileId } = useProfile();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const startEdit = (id: number, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const updated = await api.updateProfile(editingId, { name: editName, color: editColor });
    updateProfile(updated);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this profile? This cannot be undone.')) return;
    try {
      await api.deleteProfile(id);
      removeProfile(id);
    } catch {
      alert('Cannot delete a profile that has jobs. Remove the jobs first.');
    }
  };

  const handleExportCsv = async () => {
    if (!activeProfileId) return;
    setExporting(true);
    const blob = await api.exportCsv(activeProfileId);
    downloadBlob(blob, `jobs-${activeProfileId}.csv`);
    setExporting(false);
  };

  const handleExportJson = async () => {
    if (!activeProfileId) return;
    setExporting(true);
    const blob = await api.exportJson(activeProfileId);
    downloadBlob(blob, `jobs-${activeProfileId}.json`);
    setExporting(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProfileId) return;
    setImporting(true);
    setImportMsg('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const jobs = Array.isArray(parsed) ? parsed : parsed.jobs ?? [];
      const result = await api.importJson(activeProfileId, jobs);
      setImportMsg(`Imported ${result.imported ?? jobs.length} jobs.`);
      loadProfiles();
    } catch {
      setImportMsg('Import failed. Make sure the file is valid JSON.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </div>

      <div className="p-6 max-w-2xl space-y-8">
        {/* Profiles */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Profiles</h2>
          <div className="card divide-y divide-gray-800">
            {profiles.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                {editingId === p.id ? (
                  <>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 flex-shrink-0"
                    />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="input"
                      autoFocus
                    />
                    <button onClick={saveEdit} className="btn-primary py-1 text-xs flex-shrink-0">Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost py-1 text-xs flex-shrink-0">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="flex-1 text-sm text-gray-200">{p.name}</span>
                    <span className="text-xs text-gray-600 mr-2">
                      Created {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => startEdit(p.id, p.name, p.color)}
                      className="btn-ghost py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={p.id === activeProfileId}
                      title={p.id === activeProfileId ? 'Cannot delete active profile' : 'Delete profile'}
                      className="btn-ghost py-1 text-xs text-red-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
            {profiles.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">
                No profiles yet. Create one from the sidebar.
              </p>
            )}
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Data</h2>
          <p className="text-xs text-gray-600 mb-3">Operations apply to the active profile.</p>
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-200">Export CSV</p>
                <p className="text-xs text-gray-600">All jobs for active profile</p>
              </div>
              <button onClick={handleExportCsv} disabled={!activeProfileId || exporting} className="btn-primary py-1.5 text-xs">
                Download CSV
              </button>
            </div>
            <div className="border-t border-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-200">Export JSON</p>
                <p className="text-xs text-gray-600">Full data including history</p>
              </div>
              <button onClick={handleExportJson} disabled={!activeProfileId || exporting} className="btn-primary py-1.5 text-xs">
                Download JSON
              </button>
            </div>
            <div className="border-t border-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-200">Import JSON</p>
                <p className="text-xs text-gray-600">Merges into active profile</p>
              </div>
              <label className={`btn-primary py-1.5 text-xs cursor-pointer ${!activeProfileId ? 'opacity-50 pointer-events-none' : ''}`}>
                {importing ? 'Importing…' : 'Choose file'}
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>
            {importMsg && (
              <p className={`text-xs ${importMsg.startsWith('Import failed') ? 'text-red-400' : 'text-green-400'}`}>
                {importMsg}
              </p>
            )}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">About</h2>
          <div className="card p-4 text-sm text-gray-400 space-y-1">
            <p>JobTrack v1.0.0</p>
            <p>Backend: <span className="font-mono text-gray-300">http://localhost:8000</span></p>
            <p>Dashboard: <span className="font-mono text-gray-300">http://localhost:5173</span></p>
          </div>
        </section>
      </div>
    </div>
  );
}
