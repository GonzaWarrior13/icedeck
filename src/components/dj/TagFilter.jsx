import React from 'react';
import { Search } from 'lucide-react';

export default function TagFilter({ filter, setFilter, tags, activeTag, setActiveTag }) {
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search title or artist…"
          aria-label="Search title or artist"
          className="w-full h-11 pl-10 pr-3.5 rounded-[10px] bg-secondary/70 border border-transparent text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto scroll-area -mx-4 px-4 md:mx-0 md:flex-wrap md:px-0">
        {tags.map((t) => {
          const active = activeTag === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              aria-pressed={active}
              className={`min-h-8 shrink-0 rounded-full border px-3 text-[12px] transition-colors ${
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