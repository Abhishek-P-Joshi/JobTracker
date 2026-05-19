import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ProfileSwitcher from '../ProfileSwitcher';
import AddJobModal from '../AddJobModal';
import KeyboardShortcutsHelp from '../KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useProfile } from '../../hooks/useProfile';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { api } from '../../api/client';

const NAV = [
  { to: '/',             label: 'Dashboard' },
  { to: '/applications', label: 'Applications' },
  { to: '/insights',     label: 'Insights' },
  { to: '/settings',     label: 'Settings' },
];

export default function AppShell() {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { activeProfileId } = useProfile();
  const shortcutsEnabled = useAppSettingsStore((s) => s.shortcutsEnabled);

  useKeyboardShortcuts({
    onAddJob: () => { if (activeProfileId) setShowAddModal(true); },
    onShowHelp: () => setShowHelp((v) => !v),
    disabled: !shortcutsEnabled || showAddModal || showHelp,
  });

  useEffect(() => {
    const ping = () => { void api.ping().then(setBackendUp).catch(() => setBackendUp(false)); };
    ping();
    const timer = setInterval(ping, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-brand shadow-[0_0_8px_#6366f1]" />
            <span className="text-base font-bold tracking-tight text-white">JobTrack</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-brand' : 'bg-gray-700'
                    }`}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Add Job button */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!activeProfileId}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-brand hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Job
            {shortcutsEnabled && <kbd className="ml-auto text-xs opacity-60 font-mono">N</kbd>}
          </button>
        </div>

        {/* Profile switcher */}
        <div className="px-3 pb-2">
          <ProfileSwitcher />
        </div>

        {/* Backend status + help */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="ml-auto text-gray-600 hover:text-gray-400 text-xs transition-colors"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
        <div className="px-4 pb-3 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              backendUp === null ? 'bg-gray-600' :
              backendUp ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-500">
            {backendUp === null ? 'Checking…' : backendUp ? 'Backend connected' : 'Backend offline'}
          </span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </div>

      {showAddModal && <AddJobModal onClose={() => setShowAddModal(false)} />}
      {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
