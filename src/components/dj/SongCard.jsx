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
  return (
    <div className={`group flex items-center gap-3 p-3 rounded-xl border transition ${isActive ? 'bg-cyan-400/10 border-cyan-400/40' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}>
      <button
        onClick={() => onPlay(song)}
        className="shrink-0 w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center hover:bg-cyan-300 transition"
        title="Play now"
      >
        <Play className="w-4 h-4 fill-current" />
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
        <p className="truncate text-xs text-slate-400">{song.artist || 'Unknown'} · {formatTime(song.duration)}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((t) => (
              <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border ${TAG_COLORS[t] || 'bg-slate-700/40 text-slate-300 border-slate-600'}`}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
        <button onClick={() => onToggleQuick(song)} title="Quick access" className={`p-2 rounded-lg hover:bg-slate-800 ${isQuick ? 'text-cyan-300' : 'text-slate-500'}`}>
          <Star className={`w-4 h-4 ${isQuick ? 'fill-current' : ''}`} />
        </button>
        <button onClick={() => onAddQueue(song)} title="Add to queue" className="p-2 rounded-lg hover:bg-slate-800 text-slate-300">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={() => onEdit(song)} title="Edit start point" className="p-2 rounded-lg hover:bg-slate-800 text-slate-300">
          <Scissors className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(song)} title="Delete" className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-300">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}