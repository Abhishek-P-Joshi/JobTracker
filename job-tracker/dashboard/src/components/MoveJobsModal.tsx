import { useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useMoveJobs } from '../hooks/useJobs';

interface Props {
  jobIds: number[];
  currentProfileId: number;
  onClose: () => void;
  onMoved: (targetProfileId: number, previousProfileId: number) => void;
}

export default function MoveJobsModal({ jobIds, currentProfileId, onClose, onMoved }: Props) {
  const { profiles } = useProfileStore();
  const targets = profiles.filter((p) => p.id !== currentProfileId);
  const [targetId, setTargetId] = useState<number>(targets[0]?.id ?? 0);
  const move = useMoveJobs();

  const handleMove = async () => {
    if (!targetId) return;
    await move.mutateAsync({ jobIds, targetProfileId: targetId });
    onMoved(targetId, currentProfileId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-96 p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white mb-1">Move Jobs</h2>
        <p className="text-sm text-gray-400 mb-4">
          Moving {jobIds.length} job{jobIds.length !== 1 ? 's' : ''} to another profile.
        </p>

        <label className="block text-xs text-gray-400 mb-1.5">Target profile</label>
        {targets.length === 0 ? (
          <p className="text-sm text-gray-500">No other profiles exist.</p>
        ) : (
          <select
            value={targetId}
            onChange={(e) => setTargetId(Number(e.target.value))}
            className="select mb-5"
          >
            {targets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={handleMove}
            disabled={!targetId || move.isPending || targets.length === 0}
            className="btn-primary"
          >
            {move.isPending ? 'Moving…' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
