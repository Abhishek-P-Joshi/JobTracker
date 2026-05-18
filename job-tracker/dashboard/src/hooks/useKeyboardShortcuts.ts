import { useEffect, useRef } from 'react';

interface Shortcuts {
  onAddJob?: () => void;
  onShowHelp?: () => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts({ onAddJob, onShowHelp, disabled }: Shortcuts) {
  const onAddJobRef = useRef(onAddJob);
  const onShowHelpRef = useRef(onShowHelp);
  const disabledRef = useRef(disabled);

  useEffect(() => { onAddJobRef.current = onAddJob; }, [onAddJob]);
  useEffect(() => { onShowHelpRef.current = onShowHelp; }, [onShowHelp]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onAddJobRef.current?.(); }
      if (e.key === '?') { e.preventDefault(); onShowHelpRef.current?.(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []); // registered once; latest callbacks always read via refs
}
