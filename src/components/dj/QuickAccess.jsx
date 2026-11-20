import React from 'react';
import { Zap } from 'lucide-react';

export default function QuickAccess({ songs, onPlay }) {
  if (!songs.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Zap className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Quick Access
      </div>
      <div className="flex flex-wrap gap-2">
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => onPlay(song)}
            aria-label={`Play ${song.title}`}
            className="min-h-11 px-3 py-2 rounded-lg bg-card/70 border border-border hover:border-primary/50 hover:bg-primary/5 transition text-sm text-left max-w-[220px]"
          >
            <span className="block truncate font-medium">{song.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{song.artist || 'Unknown'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}