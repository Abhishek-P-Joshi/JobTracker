import { useEffect } from 'react';

interface Props { onClose: () => void; }

const SHORTCUTS = [
  { key: 'N',   description: 'Add new job' },
  { key: '?',   description: 'Toggle this help' },
  { key: 'Esc', description: 'Close panel / modal' },
];

export default function KeyboardShortcutsHelp({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.key === '?') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative card w-72 p-5 shadow-2xl"
      >
        <h2 id="shortcuts-title" className="text-sm font-semibold text-white mb-3">Keyboard Shortcuts</h2>
        <div className="space-y-2.5">
          {SHORTCUTS.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{description}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-800 border border-gray-700 rounded text-gray-300">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-600">Shortcuts inactive when typing in a field.</p>
      </div>
    </div>
  );
}
