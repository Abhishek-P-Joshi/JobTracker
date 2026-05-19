import { useState, useEffect } from 'react';
import { useProfile } from '../hooks/useProfile';
import { api } from '../api/client';
import type { AnalysisSummary, JobAnalysis } from '../types';

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return <span className={`text-lg font-bold ${cls}`}>{score}</span>;
}

function FullAnalysis({ data }: { data: JobAnalysis }) {
  const [showStrengths, setShowStrengths] = useState(false);
  const [showGaps, setShowGaps] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
      {/* Score row */}
      <div className="flex items-baseline gap-2">
        <ScoreBadge score={data.current_score} />
        <span className="text-xs text-gray-500">/ 100</span>
        {data.projected_score != null && (
          <span className="text-xs text-gray-500">→ {data.projected_score} projected</span>
        )}
      </div>

      {data.verdict && <p className="text-xs text-gray-400 italic">{data.verdict}</p>}

      {/* Strengths */}
      {data.strengths.length > 0 && (
        <div>
          <button
            onClick={() => setShowStrengths((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            <span>{showStrengths ? '▾' : '▸'}</span> Strengths ({data.strengths.length})
          </button>
          {showStrengths && (
            <ul className="mt-1 space-y-0.5 pl-3">
              {data.strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-300">✓ {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Gaps */}
      {data.gaps.length > 0 && (
        <div>
          <button
            onClick={() => setShowGaps((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            <span>{showGaps ? '▾' : '▸'}</span> Gaps ({data.gaps.length})
          </button>
          {showGaps && (
            <ul className="mt-1 space-y-0.5 pl-3">
              {data.gaps.map((g, i) => (
                <li key={i} className="text-xs text-gray-300">✗ {g}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Suggestions</p>
          {data.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-gray-300">
              • {s.text}{s.score_impact > 0 ? <span className="text-indigo-400"> (+{s.score_impact} pts)</span> : null}
            </p>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600">
        Scored: {data.scored_resume_filename}
        {data.master_resume_filename !== data.scored_resume_filename && (
          <> · Master: {data.master_resume_filename}</>
        )}
      </p>
    </div>
  );
}

function AnalysisRow({ summary }: { summary: AnalysisSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [full, setFull] = useState<JobAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!expanded && !full) {
      setLoading(true);
      try {
        const data = await api.getAnalysis(summary.id);
        setFull(data);
      } catch {
        // keep expanded=false so user can retry
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  return (
    <div className="card px-4 py-3">
      <button className="w-full text-left" onClick={toggle}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {summary.company && summary.job_title
                ? `${summary.company} — ${summary.job_title}`
                : summary.company ?? summary.job_title ?? 'Untitled'}
            </p>
            <p className="text-xs text-gray-500 font-mono truncate">{summary.scored_resume_filename}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-baseline gap-1">
              <ScoreBadge score={summary.current_score} />
              <span className="text-xs text-gray-500">/ 100</span>
              {summary.projected_score != null && (
                <span className="text-xs text-gray-500 ml-1">→ {summary.projected_score}</span>
              )}
            </div>
            <span className="text-gray-600 text-xs">{expanded ? '▴' : '▾'}</span>
          </div>
        </div>
        {summary.verdict && !expanded && (
          <p className="text-xs text-gray-400 italic mt-1 truncate">{summary.verdict}</p>
        )}
        <p className="text-xs text-gray-600 mt-1">{new Date(summary.run_at).toLocaleString()}</p>
      </button>

      {loading && <p className="text-xs text-gray-500 mt-2">Loading…</p>}
      {expanded && full && <FullAnalysis data={full} />}
    </div>
  );
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
            No analyses yet. Open a job and click "Analyze Match", or use the Analyze tab in the extension.
          </p>
        )}
        {!loading && analyses.length > 0 && (
          <div className="space-y-3">
            {analyses.map((a) => <AnalysisRow key={a.id} summary={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}
