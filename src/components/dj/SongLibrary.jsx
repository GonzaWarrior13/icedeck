import React from 'react';
import SongCard from './SongCard';

export default function SongLibrary({ songs, loading, filtered, canUpload, currentSongId, onPlay, onAddQueue, onEdit, onDelete, onToggleQuick }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1.5" aria-label="Loading library">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex min-h-14 items-center gap-3 rounded-[8px] border border-border bg-card px-3 py-2"
          >
            <div className="h-9 w-9 shrink-0 rounded-[8px] bg-secondary animate-pulse" />
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
      <div className="rounded-[10px] border border-dashed border-border px-4 py-10 text-center md:py-16">
        <p className="text-[16px] font-semibold leading-tight">{filtered ? 'No matching tracks' : 'No tracks yet'}</p>
        <p className="type-meta mt-1.5">{filtered ? 'Try a different search or choose All.' : canUpload ? 'Upload a track to start your library.' : 'Ask a team editor to add tracks.'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
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