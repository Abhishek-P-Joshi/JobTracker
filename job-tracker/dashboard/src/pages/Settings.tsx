import { useState, useEffect } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useProfile } from '../hooks/useProfile';
import { useAppSettingsStore } from '../store/appSettingsStore';
import { api } from '../api/client';
import type { ResumeConfig, ResumeFile } from '../types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export default function Settings() {
  const { profiles, updateProfile, removeProfile, loadProfiles } = useProfileStore();
  const { activeProfileId } = useProfile();
  const shortcutsEnabled = useAppSettingsStore((s) => s.shortcutsEnabled);
  const toggleShortcuts  = useAppSettingsStore((s) => s.toggleShortcuts);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  // Resume Vault state
  const [resumeConfig, setResumeConfig] = useState<ResumeConfig | null>(null);
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([]);
  const [folderInput, setFolderInput] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [badgeMsg, setBadgeMsg] = useState('');
  const [badgeIsError, setBadgeIsError] = useState(false);
  const [settingResume, setSettingResume] = useState(false);

  // Declared as a function so it is hoisted and safe to call from useEffect below.
  async function loadResumeFiles() {
    setResumeLoading(true);
    setResumeError('');
    try {
      const files = await api.listResumes();
      setResumeFiles(files);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setResumeError(msg ?? 'Could not load resume files.');
    } finally {
      setResumeLoading(false);
    }
  }

  useEffect(() => {
    api.getResumeConfig().then((cfg) => {
      setResumeConfig(cfg);
      setFolderInput(cfg.folder_path ?? '');
      if (cfg.folder_path) loadResumeFiles();
    }).catch(() => {
      setFolderError('Could not load resume configuration. Is the backend running?');
    });
  // loadResumeFiles is a stable function declaration — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetFolder = async () => {
    const path = folderInput.trim();
    if (!path) return;
    setFolderSaving(true);
    setFolderError('');
    try {
      const cfg = await api.updateResumeConfig({ folder_path: path });
      setResumeConfig(cfg);
      await loadResumeFiles();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFolderError(msg ?? 'Could not set folder.');
    } finally {
      setFolderSaving(false);
    }
  };

  const handleSetResume = async (filename: string, role: 'master_resume' | 'default_resume') => {
    if (settingResume) return;
    setSettingResume(true);
    setBadgeMsg('');
    setBadgeIsError(false);
    try {
      const cfg = await api.updateResumeConfig({ [role]: filename });
      setResumeConfig(cfg);
      setResumeFiles((prev) =>
        prev.map((f) => ({
          ...f,
          is_master:  role === 'master_resume'  ? f.filename === filename : f.is_master,
          is_default: role === 'default_resume' ? f.filename === filename : f.is_default,
        }))
      );
      setBadgeMsg(role === 'master_resume' ? 'Master resume updated.' : 'Default resume updated.');
      setTimeout(() => setBadgeMsg(''), 3000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setBadgeMsg(msg ?? 'Could not update resume.');
      setBadgeIsError(true);
    } finally {
      setSettingResume(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const startEdit = (id: number, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const updated = await api.updateProfile(editingId, { name: editName.trim(), color: editColor });
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
    try {
      const blob = await api.exportCsv(activeProfileId);
      downloadBlob(blob, `jobs-${activeProfileId}.csv`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportJson = async () => {
    if (!activeProfileId) return;
    setExporting(true);
    try {
      const blob = await api.exportJson(activeProfileId);
      downloadBlob(blob, `jobs-${activeProfileId}.json`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProfileId) return;
    setImporting(true);
    setImportMsg('');
    try {
      const text = await file.text();
      let jobs: unknown[];
      try {
        const parsed = JSON.parse(text);
        jobs = Array.isArray(parsed) ? parsed : parsed.jobs ?? [];
      } catch {
        setImportMsg('Import failed. The file is not valid JSON.');
        return;
      }
      const result = await api.importJson(activeProfileId, jobs);
      setImportMsg(`Imported ${result.imported ?? jobs.length} jobs.`);
      loadProfiles();
    } catch {
      setImportMsg('Import failed. The server rejected the request.');
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

        {/* Preferences */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Preferences</h2>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p id="shortcuts-label" className="text-sm text-gray-200">Keyboard shortcuts</p>
                <p className="text-xs text-gray-600">N to add job, ? for help</p>
              </div>
              <button
                role="switch"
                aria-checked={shortcutsEnabled}
                aria-labelledby="shortcuts-label"
                onClick={toggleShortcuts}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  shortcutsEnabled ? 'bg-brand' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
                    shortcutsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Resume Vault */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Resume Vault</h2>
          <div className="card p-4 space-y-4">
            {/* Folder path */}
            <div>
              <p className="text-sm text-gray-200 mb-1">Resume folder</p>
              <p className="text-xs text-gray-500 mb-2">Absolute path to the folder containing your .pdf and .docx resumes.</p>
              <div className="flex gap-2">
                <input
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetFolder()}
                  placeholder="/Users/you/Documents/Resumes"
                  className="input flex-1 font-mono text-xs"
                />
                <button
                  onClick={handleSetFolder}
                  disabled={folderSaving || !folderInput.trim()}
                  className="btn-primary py-1.5 text-xs flex-shrink-0"
                >
                  {folderSaving ? 'Saving…' : 'Set Folder'}
                </button>
              </div>
              {folderError && <p className="text-xs text-red-400 mt-1">{folderError}</p>}
            </div>

            {/* File list */}
            {resumeConfig?.folder_path && (
              <>
                <div className="border-t border-gray-800" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-200">Files</p>
                    <button onClick={loadResumeFiles} className="text-xs text-gray-500 hover:text-gray-300">
                      Refresh
                    </button>
                  </div>

                  {resumeConfig.master_resume === resumeConfig.default_resume && resumeConfig.master_resume && (
                    <p className="text-xs text-amber-400 mb-2">
                      Same file is set for both roles — AI analysis will infer improvements from the job description only.
                    </p>
                  )}

                  {badgeMsg && (
                    <p className={`text-xs mb-2 ${badgeIsError ? 'text-red-400' : 'text-green-400'}`}>{badgeMsg}</p>
                  )}

                  {resumeLoading && (
                    <p className="text-xs text-gray-500">Loading files…</p>
                  )}

                  {resumeError && !resumeLoading && (
                    <p className="text-xs text-red-400">{resumeError}</p>
                  )}

                  {!resumeLoading && !resumeError && resumeFiles.length === 0 && (
                    <p className="text-xs text-gray-600">No .pdf or .docx files found in this folder.</p>
                  )}

                  {!resumeLoading && resumeFiles.length > 0 && (
                    <div className="divide-y divide-gray-800 rounded border border-gray-800">
                      {resumeFiles.map((f) => (
                        <div key={f.filename} className="px-3 py-2.5 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-gray-200 truncate">{f.filename}</p>
                            <p className="text-xs text-gray-600">
                              {formatBytes(f.size_bytes)} · {new Date(f.modified_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {f.is_master && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300">master</span>
                            )}
                            {f.is_default && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-950 text-green-300">default</span>
                            )}
                            {!f.is_master && (
                              <button
                                onClick={() => handleSetResume(f.filename, 'master_resume')}
                                disabled={settingResume}
                                className="text-xs text-gray-500 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Set master
                              </button>
                            )}
                            {!f.is_default && (
                              <button
                                onClick={() => handleSetResume(f.filename, 'default_resume')}
                                disabled={settingResume}
                                className="text-xs text-gray-500 hover:text-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Set default
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
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
