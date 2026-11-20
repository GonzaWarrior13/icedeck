import React from 'react';
import { Play } from 'lucide-react';

export default function QuickAccess({ songs, onPlay }) {
  if (!songs.length) return null;
  return (
    <div>
      <p className="section-label mb-2">Quick access</p>
      <div className="flex gap-2 overflow-x-auto scroll-area -mx-4 px-4 pb-1 md:mx-0 md:px-0">
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => onPlay(song)}
            aria-label={`Play ${song.title}`}
            className="flex h-14 w-[152px] shrink-0 items-center gap-2.5 rounded-[10px] border border-border/70 bg-secondary/50 px-2.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Play className="w-3 h-3 fill-current" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight">{song.title}</span>
              <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                {song.artist || 'Unknown'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}