import React from 'react';
import { Search } from 'lucide-react';

export default function TagFilter({ filter, setFilter, tags, activeTag, setActiveTag }) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search title or artist…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTag(t)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${activeTag === t ? 'bg-cyan-400 text-slate-950 border-cyan-400' : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}