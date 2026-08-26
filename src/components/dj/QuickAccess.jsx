import React from 'react';
import { Zap } from 'lucide-react';

export default function QuickAccess({ songs, onPlay }) {
  if (!songs.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-slate-500">
        <Zap className="w-3.5 h-3.5 text-cyan-400" /> Quick Access
      </div>
      <div className="flex flex-wrap gap-2">
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => onPlay(song)}
            className="px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-cyan-400/50 hover:bg-cyan-400/5 transition text-sm text-left max-w-[220px]"
          >
            <span className="block truncate font-medium">{song.title}</span>
            <span className="block truncate text-[11px] text-slate-500">{song.artist || 'Unknown'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}