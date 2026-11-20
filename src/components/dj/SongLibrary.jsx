import React from 'react';
import SongCard from './SongCard';

export default function SongLibrary({ songs, loading, currentSongId, onPlay, onAddQueue, onEdit, onDelete, onToggleQuick }) {
  if (loading) {
    return (
      <div className="border-y border-border" aria-label="Loading library">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 h-16 px-3 border-b border-border last:border-0">
            <div className="w-9 h-9 rounded-full bg-secondary animate-pulse" />
            <div className="flex-1 space-y-2">
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
      <div className="border-t border-border pt-16">
        <p className="font-display text-[32px] font-semibold leading-none">No tracks yet</p>
        <p className="mt-2 text-sm text-muted-foreground">Upload some audio to get started.</p>
      </div>
    );
  }

  return (
    <div className="border-y border-border divide-y divide-border">
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