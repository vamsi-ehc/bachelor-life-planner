import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', color: '#3947C4' },
  { path: '/workout', label: 'Workout', color: '#C4502D' },
  { path: '/learning', label: 'Learning', color: '#2E6E9E' },
  { path: '/chores', label: 'Chores', color: '#A8842A' },
  { path: '/finances', label: 'Finances', color: '#2E7A54' },
  { path: '/meals', label: 'Meals', color: '#B4527E' },
  { path: '/health', label: 'Health', color: '#2E8E88' },
  { path: '/goals', label: 'Goals', color: '#6C5DA0' },
  { path: '/reminders', label: 'Reminders', color: '#D68A2E' },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-display font-medium transition-colors ${
    isActive ? 'bg-primary-dim text-primary' : 'text-ink hover:bg-paper'
  }`;
}

export function Sidebar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:flex-none lg:h-screen lg:sticky lg:top-0 border-r border-line bg-card">
      <div className="px-5 py-5 border-b border-line font-display font-bold text-lg tracking-tight">
        Punch<span className="text-primary">·</span>In
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={navLinkClass}>
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: item.color }} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-line flex flex-col gap-0.5">
        <NavLink to="/settings" className={navLinkClass}>
          <span className="w-2 h-2 rounded-full flex-none bg-line" />
          Settings
        </NavLink>
        <button
          type="button"
          onClick={onSignOut}
          className="text-left px-3 py-2 rounded-lg text-sm font-mono text-muted hover:text-ink hover:bg-paper transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
