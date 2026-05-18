import { useMemo, useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useJobs } from '../hooks/useJobs';
import { useAnalyticsSummary } from '../hooks/useAnalytics';
import KanbanBoard from '../components/KanbanBoard';
import JobDetailPanel from '../components/JobDetailPanel';
import type { Job, Status } from '../types';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

const ACTIVE_STATUSES: Status[] = ['applied', 'screening', 'interview'];

export default function Dashboard() {
  const { activeProfile, activeProfileId } = useProfile();
  const { data: jobs = [], isPending } = useJobs(activeProfileId);
  const { data: summary } = useAnalyticsSummary(activeProfileId);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  if (!activeProfileId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-2">No profile selected</p>
          <p className="text-sm text-gray-600">Create a profile using the switcher in the sidebar.</p>
        </div>
      </div>
    );
  }

  const activePipeline = ACTIVE_STATUSES.reduce(
    (sum, s) => sum + (summary?.by_status[s] ?? 0), 0
  );
  const thisWeek = useMemo(() => {
    const now = Date.now();
    return jobs.filter((j) => now - new Date(j.created_at).getTime() < 7 * 86_400_000).length;
  }, [jobs]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{activeProfile?.name ?? 'Dashboard'}</h1>
            <p className="text-xs text-gray-500">{jobs.length} total applications</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="px-6 py-4 grid grid-cols-4 gap-3">
          <StatCard label="Total" value={summary?.total ?? jobs.length} />
          <StatCard label="Active Pipeline" value={activePipeline} />
          <StatCard
            label="Response Rate"
            value={summary ? `${Math.round(summary.response_rate * 100)}%` : '—'}
            sub="screening + above"
          />
          <StatCard label="This Week" value={thisWeek} sub="new applications" />
        </div>

        {/* Kanban */}
        <div className="flex-1 overflow-hidden pt-2">
          {isPending ? (
            <div className="px-6 flex gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-64 flex-shrink-0">
                  <div className="skeleton h-5 w-24 mb-2" />
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, j) => (
                      <div key={j} className="skeleton h-24 rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <KanbanBoard jobs={jobs} onJobClick={(j: Job) => setSelectedJobId(j.id)} />
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedJobId && (
        <JobDetailPanel
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
