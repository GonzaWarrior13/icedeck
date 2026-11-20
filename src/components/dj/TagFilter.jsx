import React from 'react';
import { Search } from 'lucide-react';

export default function TagFilter({ filter, setFilter, tags, activeTag, setActiveTag }) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search title or artist…"
          aria-label="Search title or artist"
          className="w-full min-h-11 pl-9 pr-3 py-2 rounded-lg bg-card/60 border border-border text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTag(t)}
            aria-pressed={activeTag === t}
            className={`text-xs min-h-11 px-3 py-2 rounded-full border transition ${activeTag === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/60 text-muted-foreground border-border hover:border-muted-foreground/40'}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}