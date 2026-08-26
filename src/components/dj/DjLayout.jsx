import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Disc3, Library, ListMusic } from 'lucide-react';
import { DjProvider } from '@/lib/DjContext';

const nav = [
  { to: '/', label: 'Library', icon: Library },
  { to: '/playlists', label: 'Setlists', icon: ListMusic },
];

export default function DjLayout() {
  const { pathname } = useLocation();
  return (
    <DjProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
        <aside className="md:w-56 md:min-h-screen border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/60 backdrop-blur flex md:flex-col items-center md:items-stretch px-4 md:px-5 py-4 gap-3">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-lg md:mb-6">
            <Disc3 className="w-7 h-7 text-cyan-400" />
            <span className="hidden md:inline">Ice<span className="text-cyan-400">Deck</span></span>
          </div>
          <nav className="flex md:flex-col gap-1 w-full">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${active ? 'bg-cyan-400/10 text-cyan-300' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="hidden md:block mt-auto text-[11px] text-slate-600 leading-relaxed">
            DJ console for the rink. Upload, cue, fade.
          </div>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </DjProvider>
  );
}