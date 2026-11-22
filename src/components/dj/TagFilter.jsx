import React from 'react';
import { Search } from 'lucide-react';

export default function TagFilter({ filter, setFilter, tags, activeTag, setActiveTag }) {
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search title or artist…"
          aria-label="Search title or artist"
          className="w-full h-11 pl-9 pr-3 rounded-[8px] bg-card border border-border text-[14px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
              className={`min-h-8 shrink-0 rounded-[8px] border px-2.5 text-[14px] font-medium transition-colors md:text-[12px] ${
                active
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
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