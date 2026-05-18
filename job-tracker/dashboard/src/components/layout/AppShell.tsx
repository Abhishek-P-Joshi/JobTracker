import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ProfileSwitcher from '../ProfileSwitcher';
import { api } from '../../api/client';

const NAV = [
  { to: '/',             label: 'Dashboard',    abbr: 'DB' },
  { to: '/applications', label: 'Applications', abbr: 'AP' },
  { to: '/insights',     label: 'Insights',     abbr: 'IN' },
  { to: '/settings',     label: 'Settings',     abbr: 'ST' },
];

export default function AppShell() {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    api.ping().then(setBackendUp);
    const timer = setInterval(() => api.ping().then(setBackendUp), 30_000);
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

        {/* Profile switcher */}
        <div className="px-3 pb-2">
          <ProfileSwitcher />
        </div>

        {/* Backend status */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
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
    </div>
  );
}
