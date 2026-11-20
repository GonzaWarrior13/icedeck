import React from 'react';
import { Search } from 'lucide-react';

export default function TagFilter({ filter, setFilter, tags, activeTag, setActiveTag }) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search title or artist…"
          aria-label="Search title or artist"
          className="w-full h-12 pl-11 pr-4 rounded-[10px] bg-secondary border border-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const active = activeTag === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              aria-pressed={active}
              className={`min-h-9 px-3.5 rounded-full border text-[13px] transition-colors ${
                active
                  ? 'bg-primary/10 border-primary/60 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}