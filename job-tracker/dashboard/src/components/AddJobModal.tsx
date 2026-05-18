import { useState, useEffect } from 'react';
import axios from 'axios';
import { useCreateJob } from '../hooks/useJobs';
import { useProfile } from '../hooks/useProfile';
import type { Status, WorkType, CreateJobPayload } from '../types';
import { STATUS_ORDER, STATUS_LABELS, WORK_TYPE_LABELS } from '../types';

interface Props {
  onClose: () => void;
}

function localDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AddJobModal({ onClose }: Props) {
  const { activeProfileId } = useProfile();
  const createJob = useCreateJob();

  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Status>('applied');
  const [workType, setWorkType] = useState<WorkType>('unknown');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [appliedDate, setAppliedDate] = useState(localDateString());
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState<{ company: string; title: string } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const buildPayload = (overrideUrl?: string | null): CreateJobPayload => ({
    profile_id: activeProfileId!,
    company: company.trim(),
    title: title.trim(),
    status,
    work_type: workType,
    location: location.trim() || null,
    url: overrideUrl !== undefined ? overrideUrl : (url.trim() || null),
    applied_date: appliedDate || null,
    salary_min: salaryMin ? Number(salaryMin) : null,
    salary_max: salaryMax ? Number(salaryMax) : null,
    currency,
    notes: notes.trim() || null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !title.trim() || !activeProfileId) return;
    setError('');
    setDuplicateInfo(null);

    try {
      await createJob.mutateAsync(buildPayload());
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const d = err.response.data?.detail;
        setDuplicateInfo({ company: d?.company ?? '', title: d?.title ?? '' });
      } else {
        setError('Failed to save. Is the backend running?');
      }
    }
  };

  const handleSaveWithoutUrl = async () => {
    if (!activeProfileId) return;
    setDuplicateInfo(null);
    try {
      await createJob.mutateAsync(buildPayload(null));
      onClose();
    } catch {
      setError('Failed to save. Is the backend running?');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative card w-[480px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-semibold text-white mb-4">Add Job</h2>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Company *</label>
              <input
                autoFocus
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="input"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Software Engineer"
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="select">
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Work Type</label>
              <select value={workType} onChange={(e) => setWorkType(e.target.value as WorkType)} className="select">
                {(['remote', 'hybrid', 'onsite', 'unknown'] as WorkType[]).map((w) => (
                  <option key={w} value={w}>{WORK_TYPE_LABELS[w]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Bengaluru, India"
              className="input"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Job URL</label>
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setDuplicateInfo(null); }}
              placeholder="https://…"
              className="input"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Applied Date</label>
            <input
              type="date"
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Salary</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="Min"
                className="input"
              />
              <input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="Max"
                className="input"
              />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="select w-20 flex-shrink-0">
                {['INR', 'USD', 'CAD', 'GBP', 'EUR', 'SGD'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input resize-none"
            />
          </div>
        </div>

        {duplicateInfo && (
          <div className="mt-3 p-3 bg-amber-950 border border-amber-800 rounded-lg">
            <p className="text-xs text-amber-300 mb-2">
              This URL is already saved as &ldquo;{duplicateInfo.title}&rdquo; at {duplicateInfo.company}.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleSaveWithoutUrl} className="text-xs text-amber-300 hover:text-amber-100 underline">
                Save without URL
              </button>
              <button type="button" onClick={() => setDuplicateInfo(null)} className="text-xs text-gray-500 hover:text-gray-300">
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            type="submit"
            disabled={!company.trim() || !title.trim() || createJob.isPending}
            className="btn-primary"
          >
            {createJob.isPending ? 'Saving…' : 'Add Job'}
          </button>
        </div>
      </form>
    </div>
  );
}
