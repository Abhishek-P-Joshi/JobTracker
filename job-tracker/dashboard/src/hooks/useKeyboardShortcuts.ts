import { useEffect } from 'react';

interface Shortcuts {
  onAddJob?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts({ onAddJob, onShowHelp }: Shortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onAddJob?.(); }
      if (e.key === '?') { e.preventDefault(); onShowHelp?.(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onAddJob, onShowHelp]);
}
