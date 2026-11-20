import React from 'react';
import { formatTime } from '@/lib/audio';
import { Play, Plus, Scissors, Star, Trash2 } from 'lucide-react';

const iconButton = 'min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-[8px] transition-colors';

export default function SongCard({ song, isActive, onPlay, onAddQueue, onEdit, onDelete, onToggleQuick }) {
  const tags = song.tags || [];
  const isQuick = tags.includes('quick');
  // Spotify imports carry no audio file unless Spotify serves a preview clip.
  const playable = !!(song.file_url || song.preview_url);

  return (
    <div
      className={`group flex flex-wrap items-center gap-3 px-3 py-3 md:min-h-16 transition-colors ${
        isActive ? 'bg-primary/10' : 'hover:bg-secondary/60'
      }`}
    >
      <button
        onClick={() => onPlay(song)}
        disabled={!playable}
        className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-colors disabled:opacity-40 ${
          isActive
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-border text-primary hover:border-primary/60'
        }`}
        title={playable ? 'Play now' : 'No audio available for this track'}
        aria-label={playable ? `Play ${song.title}` : `${song.title} has no audio available`}
      >
        <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-[15px] font-medium ${isActive ? 'text-primary' : ''}`}>{song.title}</p>
          {song.start_point > 0 && (
            <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[11px] tabular-nums text-primary">
              {formatTime(song.start_point)}
            </span>
          )}
        </div>
        <p className="truncate text-[13px] text-muted-foreground">
          {song.artist || 'Unknown'} <span className="opacity-60">·</span>{' '}
          <span className="tabular-nums">{formatTime(song.duration)}</span>
        </p>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 max-md:w-full max-md:justify-end transition-opacity md:opacity-60 md:group-hover:opacity-100">
        <button
          onClick={() => onToggleQuick(song)}
          title="Quick access"
          aria-label={isQuick ? `Remove ${song.title} from quick access` : `Add ${song.title} to quick access`}
          aria-pressed={isQuick}
          className={`${iconButton} ${isQuick ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
        >
          <Star className={`w-4 h-4 ${isQuick ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
        <button
          onClick={() => onAddQueue(song)}
          title="Add to queue"
          aria-label={`Add ${song.title} to queue`}
          className={`${iconButton} text-muted-foreground hover:text-foreground hover:bg-secondary`}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onEdit(song)}
          title="Edit start point"
          aria-label={`Edit start point for ${song.title}`}
          className={`${iconButton} text-muted-foreground hover:text-foreground hover:bg-secondary`}
        >
          <Scissors className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onDelete(song)}
          title="Delete"
          aria-label={`Delete ${song.title}`}
          className={`${iconButton} text-muted-foreground hover:text-destructive hover:bg-destructive/10`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}