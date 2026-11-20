import React, { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Disc3, Library, ListMusic, Settings as SettingsIcon } from 'lucide-react';
import { DjProvider } from '@/lib/DjContext';
import MobileTabBar from './MobileTabBar';
import PageTransition from './PageTransition';

const nav = [
  { to: '/', label: 'Library', icon: Library },
  { to: '/playlists', label: 'Setlists', icon: ListMusic },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const PageFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" aria-label="Loading" />
  </div>
);

export default function DjLayout() {
  const { pathname } = useLocation();
  return (
    <DjProvider>
      <div className="app-shell-height bg-background text-foreground flex flex-col md:flex-row overflow-hidden md:overflow-visible">
        <aside className="shrink-0 md:w-56 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-card/70 backdrop-blur flex md:flex-col items-center md:items-stretch px-3 md:px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:py-5 gap-3">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-lg md:mb-6">
            <Disc3 className="w-7 h-7 text-primary" aria-hidden="true" />
            <span className="hidden md:inline">Ice<span className="text-primary">Deck</span></span>
          </div>
          <nav className="flex md:flex-col gap-1 w-full" aria-label="Sections">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-center md:justify-start gap-2 min-h-11 min-w-11 px-3 py-2 rounded-lg text-sm no-select transition ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  <Icon className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="hidden md:block mt-auto text-[11px] text-muted-foreground/70 leading-relaxed">
            DJ console for the rink. Upload, cue, fade.
          </div>
        </aside>

        <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto scroll-area md:overflow-visible">
          <Suspense fallback={<PageFallback />}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </Suspense>
        </main>

        <MobileTabBar />
      </div>
    </DjProvider>
  );
}