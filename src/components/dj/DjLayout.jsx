import React, { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Disc3, Library, ListMusic, Settings as SettingsIcon } from 'lucide-react';
import { DjProvider } from '@/lib/DjContext';
import { useSimpleMode } from '@/lib/simpleMode';
import MobileTabBar from './MobileTabBar';
import BrandMark from './BrandMark';
import PageTransition from './PageTransition';

const PageFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" aria-label="Loading" />
  </div>
);

export default function DjLayout() {
  const { pathname } = useLocation();
  const { enabled: simpleMode } = useSimpleMode();

  // Simple mode keeps only the console and the way back to Settings.
  const primary = simpleMode
    ? [{ to: '/', label: 'Console', icon: Disc3 }]
    : [
        { to: '/', label: 'Library', icon: Library },
        { to: '/playlists', label: 'Setlists', icon: ListMusic },
      ];
  const settingsItem = { to: '/settings', label: 'Settings', icon: SettingsIcon };

  const NavLink = ({ to, label, icon: Icon }) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={`relative flex items-center gap-3 min-h-10 px-3 rounded-[10px] text-[14px] no-select transition-colors ${
          active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        }`}
      >
        {active && (
          <span className="hidden md:block absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-primary" aria-hidden="true" />
        )}
        <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="hidden md:inline">{label}</span>
      </Link>
    );
  };

  return (
    <DjProvider>
      <div className={`${simpleMode ? 'simple-shell' : 'app-shell-height'} bg-background text-foreground flex flex-col md:flex-row overflow-hidden md:overflow-visible`}>
        <aside className="shrink-0 md:w-[212px] md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-card flex md:flex-col items-center md:items-stretch px-4 md:px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2.5 md:py-7 gap-3 md:gap-0">
          <Link to="/" className="no-select flex flex-1 justify-center md:flex-none md:justify-center md:mb-8" aria-label="Rinkbeats home">
            <BrandMark />
          </Link>

          <nav
            className={`${simpleMode ? 'flex' : 'hidden'} md:flex md:flex-col gap-1 w-full md:w-auto`}
            aria-label="Sections"
          >
            {primary.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </nav>

          <div className="ml-auto md:ml-0 md:mt-auto md:pt-4 md:border-t md:border-border">
            <NavLink {...settingsItem} />
          </div>
        </aside>

        <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto scroll-area md:overflow-visible">
          <Suspense fallback={<PageFallback />}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </Suspense>
        </main>

        {!simpleMode && <MobileTabBar />}
      </div>
    </DjProvider>
  );
}