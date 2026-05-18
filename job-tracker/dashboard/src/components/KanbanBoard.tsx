import type { Job, Status } from '../types';
import { STATUS_ORDER, STATUS_LABELS, STATUS_COLORS } from '../types';
import JobCard from './JobCard';

interface Props {
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

export default function KanbanBoard({ jobs, onJobClick }: Props) {
  const byStatus = STATUS_ORDER.reduce<Record<Status, Job[]>>(
    (acc, s) => ({ ...acc, [s]: [] }),
    {} as Record<Status, Job[]>
  );
  jobs.forEach((j) => byStatus[j.status].push(j));

  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-4 px-6">
      {STATUS_ORDER.map((status) => {
        const col = byStatus[status];
        const sc = STATUS_COLORS[status];
        return (
          <div key={status} className="flex flex-col w-64 flex-shrink-0">
            {/* Column header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <span className={`badge ${sc.bg} ${sc.text} text-xs`}>{col.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-[120px] rounded-lg bg-gray-900/40 p-2 border border-gray-800/60">
              {col.length === 0 ? (
                <p className="text-xs text-gray-700 text-center pt-4">No jobs</p>
              ) : (
                col.map((job) => (
                  <JobCard key={job.id} job={job} onClick={() => onJobClick(job)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
