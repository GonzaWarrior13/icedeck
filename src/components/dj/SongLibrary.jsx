import React from 'react';
import SongCard from './SongCard';

export default function SongLibrary({ songs, loading, currentSongId, onPlay, onAddQueue, onEdit, onDelete, onToggleQuick }) {
  if (loading) {
    return (
      <div className="border-y border-border/70" aria-label="Loading library">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2.5 h-14 md:h-16 md:px-3 border-b border-border/70 last:border-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-secondary animate-pulse" />
            <div className="flex-1 space-y-1.5 md:space-y-2">
              <div className="h-3 w-40 rounded-full bg-secondary animate-pulse" />
              <div className="h-2.5 w-24 rounded-full bg-secondary/70 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!songs.length) {
    return (
      <div className="border-t border-border/70 pt-10 md:pt-16">
        <p className="font-display text-[26px] font-semibold leading-none md:text-[32px]">No tracks yet</p>
        <p className="mt-1.5 text-[13px] text-muted-foreground md:mt-2 md:text-sm">Upload some audio to get started.</p>
      </div>
    );
  }

  return (
    <div className="border-y border-border/70 divide-y divide-border/70">
      {songs.map((song) => (
        <SongCard
          key={song.id}
          song={song}
          isActive={song.id === currentSongId}
          onPlay={onPlay}
          onAddQueue={onAddQueue}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleQuick={onToggleQuick}
        />
      ))}
    </div>
  );
}