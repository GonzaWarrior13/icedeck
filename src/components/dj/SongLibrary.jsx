import React from 'react';
import SongCard from './SongCard';
import { Loader2 } from 'lucide-react';

export default function SongLibrary({ songs, loading, currentSongId, onPlay, onAddQueue, onEdit, onDelete, onToggleQuick }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading library…
      </div>
    );
  }
  if (!songs.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No tracks yet. Upload some audio to get started.
      </div>
    );
  }
  return (
    <div className="space-y-2">
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