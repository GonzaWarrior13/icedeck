import React from 'react';
import { Play } from 'lucide-react';

export default function QuickAccess({ songs, onPlay }) {
  if (!songs.length) return null;
  return (
    <div>
      <p className="section-label mb-3">Quick access</p>
      <div className="flex gap-3 overflow-x-auto scroll-area pb-1">
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => onPlay(song)}
            aria-label={`Play ${song.title}`}
            className="shrink-0 w-[168px] h-[72px] rounded-[10px] bg-secondary px-4 flex flex-col justify-center gap-1 text-left transition-colors hover:bg-secondary/70"
          >
            <Play className="w-3.5 h-3.5 text-primary fill-current" aria-hidden="true" />
            <span className="w-full truncate text-sm font-medium">{song.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}