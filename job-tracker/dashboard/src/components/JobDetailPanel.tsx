import { useState, useEffect, useRef } from 'react';
import { useJob, useUpdateJob, useDeleteJob } from '../hooks/useJobs';
import type { Job, Status, WorkType } from '../types';
import { STATUS_ORDER, STATUS_LABELS, STATUS_COLORS, WORK_TYPE_LABELS } from '../types';

interface Props {
  jobId: number;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}

export default function JobDetailPanel({ jobId, onClose }: Props) {
  const { data: job, isPending } = useJob(jobId);
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();

  const [form, setForm] = useState<Partial<Job>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const prevJobIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (job && job.id !== prevJobIdRef.current) {
      prevJobIdRef.current = job.id;
      setForm(job);
    }
  }, [job]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const patch = (field: keyof Job, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (job) updateJob.mutate({ id: job.id, data: { [field]: value } });
  };

  const handleDelete = async () => {
    if (!job) return;
    await deleteJob.mutateAsync(job.id);
    onClose();
  };

  const saveNotes = () => {
    if (job && form.notes !== job.notes) updateJob.mutate({ id: job.id, data: { notes: form.notes } });
  };

  const safeUrl = /^https?:\/\//i.test(job?.url ?? '') ? job?.url : null;

  if (isPending || !job) {
    return (
      <div className="w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 p-6 space-y-4">
        {[80, 40, 60, 40, 60].map((w, i) => (
          <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div className="fixed inset-0 z-30 lg:hidden bg-black/40" onClick={onClose} />

      <div className="w-96 flex-shrink-0 flex flex-col bg-gray-900 border-l border-gray-800 z-40 overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <input
              value={form.company ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              onBlur={() => patch('company', form.company)}
              className="bg-transparent text-xs text-gray-400 w-full outline-none hover:bg-gray-800 focus:bg-gray-800 rounded px-1 -mx-1"
            />
            <input
              value={form.title ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onBlur={() => patch('title', form.title)}
              className="bg-transparent text-base font-semibold text-white w-full outline-none hover:bg-gray-800 focus:bg-gray-800 rounded px-1 -mx-1 mt-0.5"
            />
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300 text-xl leading-none flex-shrink-0">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {/* Status */}
          <Field label="Status">
            <select
              value={form.status ?? job.status}
              onChange={(e) => patch('status', e.target.value as Status)}
              className="select"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>

          {/* Work type */}
          <Field label="Work Type">
            <select
              value={form.work_type ?? job.work_type}
              onChange={(e) => patch('work_type', e.target.value as WorkType)}
              className="select"
            >
              {(['remote', 'hybrid', 'onsite', 'unknown'] as WorkType[]).map((w) => (
                <option key={w} value={w}>{WORK_TYPE_LABELS[w]}</option>
              ))}
            </select>
          </Field>

          {/* Location */}
          <Field label="Location">
            <input
              value={form.location ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              onBlur={() => patch('location', form.location || null)}
              className="input"
              placeholder="e.g. Bengaluru"
            />
          </Field>

          {/* Salary */}
          <Field label="Salary">
            <div className="flex gap-2">
              <input
                type="number"
                value={form.salary_min ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, salary_min: Number(e.target.value) || null }))}
                onBlur={() => patch('salary_min', form.salary_min)}
                placeholder="Min"
                className="input"
              />
              <input
                type="number"
                value={form.salary_max ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, salary_max: Number(e.target.value) || null }))}
                onBlur={() => patch('salary_max', form.salary_max)}
                placeholder="Max"
                className="input"
              />
              <select
                value={form.currency ?? job.currency}
                onChange={(e) => patch('currency', e.target.value)}
                className="select w-20 flex-shrink-0"
              >
                {['INR', 'USD', 'CAD', 'GBP', 'EUR', 'SGD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </Field>

          {/* Applied date */}
          <Field label="Applied Date">
            <input
              type="date"
              value={form.applied_date ?? ''}
              onChange={(e) => patch('applied_date', e.target.value || null)}
              className="input"
            />
          </Field>

          {/* URL */}
          {safeUrl && (
            <Field label="Listing">
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand hover:underline truncate block"
              >
                Open listing →
              </a>
            </Field>
          )}

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              onBlur={saveNotes}
              rows={3}
              className="input resize-none"
              placeholder="Notes auto-save on blur…"
            />
          </Field>

          {/* Status timeline */}
          {job.status_history && job.status_history.length > 0 && (
            <Field label="History">
              <div className="space-y-1.5">
                {job.status_history.map((h) => {
                  const sc = STATUS_COLORS[h.new_status];
                  return (
                    <div key={h.id} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <span>{STATUS_LABELS[h.new_status]}</span>
                      <span className="text-gray-600 ml-auto">
                        {new Date(h.changed_at).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={handleDelete} className="btn-primary bg-red-600 hover:bg-red-700 flex-1 text-sm">
                {deleteJob.isPending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
            >
              Delete job
            </button>
          )}
        </div>
      </div>
    </>
  );
}
