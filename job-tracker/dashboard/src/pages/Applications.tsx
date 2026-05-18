import { useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useJobs } from '../hooks/useJobs';
import JobDetailPanel from '../components/JobDetailPanel';
import MoveJobsModal from '../components/MoveJobsModal';
import UndoToast from '../components/UndoToast';
import type { Job, WorkType, JobFilters } from '../types';
import {
  STATUS_ORDER, STATUS_LABELS, STATUS_COLORS,
  WORK_TYPE_LABELS, WORK_TYPE_COLORS,
} from '../types';
import { useMoveJobs } from '../hooks/useJobs';

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Applications() {
  const { activeProfileId, profiles } = useProfile();
  const [filters, setFilters] = useState<JobFilters>({ sort_by: 'created_at', order: 'desc' });
  const { data: jobs = [], isPending } = useJobs(activeProfileId, filters);

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [undoState, setUndoState] = useState<{ jobIds: number[]; from: number; to: number } | null>(null);
  const move = useMoveJobs();

  const toggleCheck = (id: number) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setCheckedIds(checkedIds.size === jobs.length ? new Set() : new Set(jobs.map((j) => j.id)));

  const handleMoved = (to: number, from: number) => {
    setUndoState({ jobIds: Array.from(checkedIds), from, to });
    setCheckedIds(new Set());
  };

  const handleUndo = async () => {
    if (!undoState) return;
    await move.mutateAsync({ jobIds: undoState.jobIds, targetProfileId: undoState.from });
    setUndoState(null);
  };

  if (!activeProfileId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Select a profile to view applications.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800">
          <h1 className="text-lg font-semibold text-white mb-3">Applications</h1>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filters.search ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
              placeholder="Search company or title…"
              className="input w-52"
            />

            {/* Status chips */}
            <div className="flex gap-1">
              {STATUS_ORDER.map((s) => {
                const active = filters.status === s;
                const sc = STATUS_COLORS[s];
                return (
                  <button
                    key={s}
                    onClick={() => setFilters((f) => ({ ...f, status: active ? '' : s }))}
                    className={`badge transition-colors ${active ? `${sc.bg} ${sc.text}` : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>

            {/* Work type chips */}
            <div className="flex gap-1">
              {(['remote', 'hybrid', 'onsite', 'unknown'] as WorkType[]).map((w) => {
                const active = filters.work_type === w;
                return (
                  <button
                    key={w}
                    onClick={() => setFilters((f) => ({ ...f, work_type: active ? '' : w }))}
                    className={`badge transition-colors ${active ? WORK_TYPE_COLORS[w] : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {WORK_TYPE_LABELS[w]}
                  </button>
                );
              })}
            </div>

            {/* Sort */}
            <select
              value={`${filters.sort_by}:${filters.order}`}
              onChange={(e) => {
                const [sort_by, order] = e.target.value.split(':') as [JobFilters['sort_by'], JobFilters['order']];
                setFilters((f) => ({ ...f, sort_by, order }));
              }}
              className="select w-44 ml-auto"
            >
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="company:asc">Company A–Z</option>
              <option value="applied_date:desc">Applied date ↓</option>
            </select>
          </div>
        </div>

        {/* Bulk bar */}
        {checkedIds.size > 0 && (
          <div className="px-6 py-2 bg-indigo-950 border-b border-indigo-800 flex items-center gap-3">
            <span className="text-sm text-indigo-300">{checkedIds.size} selected</span>
            <button onClick={() => setShowMoveModal(true)} className="btn-primary py-1 text-xs">
              Move to profile
            </button>
            <button onClick={() => setCheckedIds(new Set())} className="btn-ghost py-1 text-xs">
              Deselect
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isPending ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-10 rounded" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-gray-500 mb-1">No applications match your filters</p>
                <button onClick={() => setFilters({ sort_by: 'created_at', order: 'desc' })} className="text-xs text-brand hover:underline">
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checkedIds.size === jobs.length && jobs.length > 0}
                      onChange={toggleAll}
                      className="accent-brand"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wider">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {jobs.map((job: Job) => {
                  const sc = STATUS_COLORS[job.status];
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`hover:bg-gray-800/50 cursor-pointer transition-colors ${checkedIds.has(job.id) ? 'bg-indigo-950/30' : ''}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={checkedIds.has(job.id)} onChange={() => toggleCheck(job.id)} className="accent-brand" />
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-medium">{job.company}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{job.title}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${sc.bg} ${sc.text}`}>{STATUS_LABELS[job.status]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${WORK_TYPE_COLORS[job.work_type]}`}>{WORK_TYPE_LABELS[job.work_type]}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(job.applied_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedJobId && (
        <JobDetailPanel jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}

      {showMoveModal && activeProfileId && (
        <MoveJobsModal
          jobIds={Array.from(checkedIds)}
          currentProfileId={activeProfileId}
          onClose={() => setShowMoveModal(false)}
          onMoved={handleMoved}
        />
      )}

      {undoState && (
        <UndoToast
          message={`Moved ${undoState.jobIds.length} job${undoState.jobIds.length !== 1 ? 's' : ''} to ${profiles.find((p) => p.id === undoState.to)?.name ?? 'profile'}`}
          onUndo={handleUndo}
          onDismiss={() => setUndoState(null)}
        />
      )}
    </div>
  );
}
