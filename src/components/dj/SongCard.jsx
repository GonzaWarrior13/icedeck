import React from 'react';
import { formatTime } from '@/lib/audio';
import { Play, Plus, Scissors, Star, Trash2 } from 'lucide-react';

// 44px touch targets on phones; the denser 36px buttons return at md.
const iconButton =
  'flex h-11 w-11 items-center justify-center rounded-[8px] transition-colors md:h-9 md:w-9';

export default function SongCard({ song, isActive, onPlay, onAddQueue, onEdit, onDelete, onToggleQuick }) {
  const tags = song.tags || [];
  const isQuick = tags.includes('quick');
  const playable = Boolean(song.file_url || song.storage_path);

  return (
    <div
      className={`group flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 transition-colors ${
        isActive
          ? 'border-primary/40 bg-primary/10'
          : 'border-border bg-card hover:bg-secondary'
      }`}
    >
      <button
        onClick={() => onPlay(song)}
        disabled={!playable}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border transition-colors disabled:opacity-40 md:h-9 md:w-9 ${
          isActive
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-primary'
        }`}
        title={playable ? 'Play track' : 'This track is missing its audio file'}
        aria-label={playable ? `Play ${song.title}` : `${song.title} has no audio available`}
      >
        <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`type-track truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
          {song.start_point > 0 && (
            <span className="type-data shrink-0 rounded-[6px] bg-primary/15 px-1.5 py-px text-[14px] text-primary md:text-[11px]">
              {formatTime(song.start_point)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="type-meta truncate">{song.artist || 'Unknown'}</p>
          <span className="type-meta text-muted-foreground/50" aria-hidden="true">·</span>
          <span className="type-data shrink-0 text-muted-foreground">{formatTime(song.duration)}</span>
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 hidden flex-wrap gap-1 md:flex">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-[6px] bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="-mr-1 flex min-w-0 basis-full justify-end gap-0.5 sm:basis-auto sm:shrink-0 md:mr-0 md:opacity-70 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {onToggleQuick && <button
          onClick={() => onToggleQuick(song)}
          title={isQuick ? 'Remove from Quick Access' : 'Add to Quick Access'}
          aria-label={isQuick ? `Remove ${song.title} from quick access` : `Add ${song.title} to quick access`}
          aria-pressed={isQuick}
          className={`${iconButton} ${isQuick ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
        >
          <Star className={`w-4 h-4 ${isQuick ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>}
        <button
          onClick={() => onAddQueue(song)}
          title="Add to queue"
          aria-label={`Add ${song.title} to queue`}
          className={`${iconButton} text-muted-foreground hover:text-foreground hover:bg-secondary`}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
        {onEdit && <button
          onClick={() => onEdit(song)}
          title="Edit start and end times"
          aria-label={`Edit start point for ${song.title}`}
          className={`${iconButton} text-muted-foreground hover:text-foreground hover:bg-secondary`}
        >
          <Scissors className="w-4 h-4" aria-hidden="true" />
        </button>}
        {onDelete && <button
          onClick={() => onDelete(song)}
          title="Delete track"
          aria-label={`Delete ${song.title}`}
          className={`${iconButton} text-muted-foreground hover:text-destructive hover:bg-destructive/10`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>}
      </div>
    </div>
  );
}
