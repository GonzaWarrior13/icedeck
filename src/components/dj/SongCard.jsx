import React from 'react';
import { formatTime } from '@/lib/audio';
import { Play, Plus, Scissors, Star, Trash2 } from 'lucide-react';

const TAG_COLORS = {
  hype: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  timeout: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'post-goal': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  intro: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  quick: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

export default function SongCard({ song, isActive, onPlay, onAddQueue, onEdit, onDelete, onToggleQuick }) {
  const tags = song.tags || [];
  const isQuick = tags.includes('quick');
  // Spotify imports carry no audio file unless Spotify serves a preview clip.
  const playable = !!(song.file_url || song.preview_url);
  return (
    <div className={`group flex flex-wrap items-center gap-3 p-3 rounded-xl border transition ${isActive ? 'bg-primary/10 border-primary/40' : 'bg-card/60 border-border hover:border-muted-foreground/40'}`}>
      <button
        onClick={() => onPlay(song)}
        disabled={!playable}
        className="shrink-0 min-h-11 min-w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition disabled:opacity-40 disabled:hover:bg-primary"
        title={playable ? 'Play now' : 'No audio available for this track'}
        aria-label={playable ? `Play ${song.title}` : `${song.title} has no audio available`}
      >
        <Play className="w-4 h-4 fill-current" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-sm">{song.title}</p>
          {song.start_point > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              ↳ {formatTime(song.start_point)}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">{song.artist || 'Unknown'} · {formatTime(song.duration)}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((t) => (
              <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border ${TAG_COLORS[t] || 'bg-secondary text-secondary-foreground border-border'}`}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 transition md:opacity-60 md:group-hover:opacity-100 max-md:w-full max-md:justify-end">
        <button
          onClick={() => onToggleQuick(song)}
          title="Quick access"
          aria-label={isQuick ? `Remove ${song.title} from quick access` : `Add ${song.title} to quick access`}
          aria-pressed={isQuick}
          className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary ${isQuick ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Star className={`w-4 h-4 ${isQuick ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
        <button
          onClick={() => onAddQueue(song)}
          title="Add to queue"
          aria-label={`Add ${song.title} to queue`}
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary text-foreground"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onEdit(song)}
          title="Edit start point"
          aria-label={`Edit start point for ${song.title}`}
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary text-foreground"
        >
          <Scissors className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onDelete(song)}
          title="Delete"
          aria-label={`Delete ${song.title}`}
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}