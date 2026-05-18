import type { Job } from '../types';
import { WORK_TYPE_COLORS, WORK_TYPE_LABELS } from '../types';

function daysSince(dateStr: string | null) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days}d ago`;
}

function formatSalary(job: Job) {
  if (!job.salary_min && !job.salary_max) return null;
  const fmt = (n: number) =>
    job.currency === 'INR'
      ? `₹${(n / 100_000).toFixed(1)}L`
      : `${job.currency === 'USD' ? '$' : job.currency === 'CAD' ? 'CA$' : job.currency + ' '}${Math.round(n / 1000)}K`;
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  if (job.salary_min) return `${fmt(job.salary_min)}+`;
  return null;
}

interface Props {
  job: Job;
  onClick: () => void;
}

export default function JobCard({ job, onClick }: Props) {
  const salary = formatSalary(job);
  const age = daysSince(job.applied_date ?? job.created_at);

  return (
    <button
      onClick={onClick}
      className="w-full text-left card p-3 hover:border-gray-700 hover:bg-gray-800/60 transition-all cursor-pointer group"
    >
      <p className="text-xs text-gray-500 truncate mb-0.5">{job.company}</p>
      <p className="text-sm font-medium text-gray-100 leading-snug truncate group-hover:text-white">
        {job.title}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {job.location && (
          <span className="text-xs text-gray-500 truncate max-w-[120px]">
            {job.location}
          </span>
        )}
        <span className={`badge ${WORK_TYPE_COLORS[job.work_type]}`}>
          {WORK_TYPE_LABELS[job.work_type]}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        {salary ? (
          <span className="text-xs text-gray-400 font-mono">{salary}</span>
        ) : (
          <span />
        )}
        {age && <span className="text-xs text-gray-600">{age}</span>}
      </div>
    </button>
  );
}
