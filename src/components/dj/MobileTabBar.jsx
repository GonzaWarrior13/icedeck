import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Library, ListMusic } from 'lucide-react';

const TABS = [
  { key: 'library', to: '/', label: 'Library', icon: Library },
  { key: 'setlists', to: '/playlists', label: 'Setlists', icon: ListMusic },
];

const STORAGE_KEY = 'dj_tab_paths';

const readPaths = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

// Fixed bottom navigation for phones. Each tab remembers where you last were in it;
// tapping the tab you are already on resets that tab to its root.
export default function MobileTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const paths = useRef(readPaths());

  useEffect(() => {
    const tab = TABS.find((t) => t.to === pathname);
    if (!tab) return;
    paths.current[tab.key] = pathname;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(paths.current));
    } catch {
      /* ignore */
    }
  }, [pathname]);

  const go = (tab) => {
    const active = pathname === tab.to;
    navigate(active ? tab.to : paths.current[tab.key] || tab.to);
  };

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-2">
        {TABS.map(({ key, to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go({ key, to })}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[3.75rem] py-2 text-[11px] font-medium tracking-wide no-select transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {active && <span className="absolute top-0 inset-x-8 h-0.5 rounded-full bg-primary" aria-hidden="true" />}
              <Icon className="w-[22px] h-[22px]" strokeWidth={1.5} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}