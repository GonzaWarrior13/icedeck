import React from 'react';
import { Play } from 'lucide-react';

export default function QuickAccess({ songs, onPlay }) {
  if (!songs.length) return null;
  return (
    <div>
      <p className="section-label mb-2">Quick access</p>
      <div className="flex gap-3 overflow-x-auto scroll-area -mx-4 px-4 pb-1 md:mx-0 md:px-0">
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => onPlay(song)}
            aria-label={`Play ${song.title}`}
            className="flex min-h-[88px] w-[152px] shrink-0 flex-col justify-between rounded-[10px] border border-border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-secondary"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-primary/15 text-primary">
              <Play className="w-3 h-3 fill-current" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-tight">{song.title}</span>
              <span className="mt-0.5 block truncate text-[12px] leading-tight text-muted-foreground">
                {song.artist || 'Unknown'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}