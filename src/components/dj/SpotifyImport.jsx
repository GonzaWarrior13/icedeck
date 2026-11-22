import React, { useState } from 'react';
import { Music, Music2, AudioLines, Youtube, X, ChevronLeft, ChevronRight } from 'lucide-react';
import SpotifyPanel from './SpotifyPanel';
import LinkImportPanel from './LinkImportPanel';
import TracklistPanel from './TracklistPanel';

const SERVICES = [
  { key: 'amazon', name: 'Amazon Music', icon: AudioLines, hint: 'Paste a tracklist' },
  { key: 'spotify', name: 'Spotify', icon: Music, hint: 'Sign in to import playlists' },
  { key: 'youtube', name: 'YouTube Music', icon: Youtube, hint: 'Paste a playlist link' },
  { key: 'apple', name: 'Apple Music', icon: Music2, hint: 'Paste a playlist link' },
];

// One popup for every music service the console can pull a tracklist from.
export default function SpotifyImport({ existingSongs = [], onImported }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('services');
  const active = SERVICES.find((service) => service.key === view);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setView('services');
        }}
        className="inline-flex items-center gap-1.5 min-h-9 rounded-[10px] border border-border px-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:min-h-10 md:gap-2 md:px-3.5 md:text-sm"
        aria-expanded={open}
      >
        <Music className="w-3.5 h-3.5 md:w-4 md:h-4" aria-hidden="true" />
        <span className="md:hidden">Music services</span>
        <span className="hidden md:inline">Connect Music Services</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] z-30 rounded-[10px] border border-border bg-popover shadow-[0_16px_40px_rgba(0,0,0,0.5)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-popover-foreground">
              <Music className="w-4 h-4 text-primary" aria-hidden="true" />
              {active ? active.name : 'Connect music services'}
            </div>
            <div className="flex items-center gap-0.5">
              {active && (
                <button
                  onClick={() => setView('services')}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                  aria-label="Back to music services"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close music services"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {!active ? (
            <ul className="space-y-1.5">
              {SERVICES.map(({ key, name, hint, icon: Icon }) => (
                <li key={key}>
                  <button
                    onClick={() => setView(key)}
                    className="w-full flex items-center gap-3 min-h-11 rounded-[10px] border border-border px-3 text-left hover:bg-secondary hover:border-primary/50 transition-colors"
                  >
                    <Icon className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-popover-foreground">{name}</span>
                      <span className="block text-[11px] text-muted-foreground">{hint}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : view === 'spotify' ? (
            <SpotifyPanel existingSongs={existingSongs} onImported={onImported} />
          ) : view === 'apple' ? (
            <LinkImportPanel
              service="apple"
              serviceName="Apple Music"
              placeholder="https://music.apple.com/…/playlist/…"
              source="itunes"
              existingSongs={existingSongs}
              onImported={onImported}
            />
          ) : view === 'youtube' ? (
            <LinkImportPanel
              service="youtube"
              serviceName="YouTube Music"
              placeholder="https://music.youtube.com/playlist?list=…"
              source="youtube"
              existingSongs={existingSongs}
              onImported={onImported}
            />
          ) : (
            <TracklistPanel existingSongs={existingSongs} onImported={onImported} />
          )}
        </div>
      )}
    </div>
  );
}