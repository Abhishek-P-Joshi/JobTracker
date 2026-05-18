import { useEffect, useState } from 'react';

interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function UndoToast({ message, onUndo, onDismiss, duration = 8000 }: Props) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct === 0) {
        clearInterval(timer);
        onDismiss();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [duration, onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 card shadow-2xl overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-200">{message}</span>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { onUndo(); onDismiss(); }}
            className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
          >
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="h-0.5 bg-gray-800">
        <div
          className="h-full bg-brand transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
