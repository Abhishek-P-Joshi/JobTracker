import { useState, useEffect } from 'react';
import { useProfile } from '../hooks/useProfile';
import { api } from '../api/client';
import type { AnalysisSummary } from '../types';

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return <span className={`text-lg font-bold ${cls}`}>{score}</span>;
}

export default function AnalysisHistory() {
  const { activeProfileId } = useProfile();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeProfileId) return;
    setLoading(true);
    setError('');
    api.listAnalyses(activeProfileId)
      .then(setAnalyses)
      .catch(() => setError('Could not load analyses.'))
      .finally(() => setLoading(false));
  }, [activeProfileId]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white">AI Analysis</h1>
      </div>

      <div className="p-6 max-w-3xl">
        {!activeProfileId && (
          <p className="text-sm text-gray-500">Select a profile to view analyses.</p>
        )}

        {activeProfileId && loading && (
          <p className="text-sm text-gray-500">Loading…</p>
        )}

        {activeProfileId && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {activeProfileId && !loading && !error && analyses.length === 0 && (
          <p className="text-sm text-gray-500">
            No analyses yet. Open a job in the dashboard and click "Analyze Match".
          </p>
        )}

        {!loading && analyses.length > 0 && (
          <div className="space-y-3">
            {analyses.map((a) => (
              <div key={a.id} className="card px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {a.company && a.job_title
                        ? `${a.company} — ${a.job_title}`
                        : a.company ?? a.job_title ?? 'Untitled'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono truncate">{a.scored_resume_filename}</p>
                  </div>
                  <div className="flex items-baseline gap-1 flex-shrink-0">
                    <ScoreBadge score={a.current_score} />
                    <span className="text-xs text-gray-500">/ 100</span>
                    {a.projected_score != null && (
                      <span className="text-xs text-gray-500 ml-1">→ {a.projected_score} proj.</span>
                    )}
                  </div>
                </div>
                {a.verdict && (
                  <p className="text-xs text-gray-400 italic">{a.verdict}</p>
                )}
                <p className="text-xs text-gray-600">
                  {new Date(a.run_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
