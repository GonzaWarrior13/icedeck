import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Plus, X, Music2 } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'track', label: 'Tracks' },
  { value: 'album', label: 'Albums' },
  { value: 'playlist', label: 'Playlists' },
];

export default function SpotifyBrowser({ open, onOpenChange, onImported }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('track');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(new Set());

  useEffect(() => {
    if (!open) {
      setResults([]);
      setQuery('');
      setError('');
      setImportedIds(new Set());
    }
  }, [open]);

  const doSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await base44.functions.invoke('SpotifySearch', { query: q, type, limit: 20 });
      setResults(res.data.results || []);
      if (!res.data.results?.length) setError('No results. Try another search.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const importTrack = async (track) => {
    setImportingId(track.spotify_id);
    try {
      const res = await base44.functions.invoke('SpotifyImport', { track, tags: [] });
      setImportedIds((prev) => new Set(prev).add(track.spotify_id));
      onImported?.(res.data.song);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  if (!open) return null;

  const embedHeight = type === 'track' ? 152 : 380;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <span className="flex items-center gap-2 font-medium text-sm">
          <Music2 className="w-4 h-4 text-cyan-400" /> Browse Spotify
        </span>
        <button
          onClick={() => onOpenChange?.(false)}
          className="p-1 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          aria-label="Close browser"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <form onSubmit={doSearch} className="flex flex-wrap gap-2">
          <div className="flex gap-1.5">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setType(o.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${type === o.value ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-cyan-300'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${type}s…`}
              className="pl-9 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || !query.trim()} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </Button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {results.map((r) => {
            const imported = importedIds.has(r.spotify_id);
            return (
              <div key={`${r.type}-${r.spotify_id}`} className="rounded-xl overflow-hidden bg-slate-950/60 border border-slate-800">
                <div className="flex items-stretch">
                  <div className="flex-1 min-w-0">
                    <iframe
                      src={`https://open.spotify.com/embed/${r.type}/${r.spotify_id}`}
                      width="100%"
                      height={embedHeight}
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      title={`${r.title} — ${r.artist}`}
                    />
                  </div>
                  {r.type === 'track' && (
                    <div className="flex items-center px-3 border-l border-slate-800">
                      {imported ? (
                        <span className="text-xs text-cyan-400 whitespace-nowrap">Imported</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => importTrack(r)}
                          disabled={importingId === r.spotify_id}
                          className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-300 whitespace-nowrap"
                        >
                          {importingId === r.spotify_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Import
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && !results.length && !error && (
            <p className="text-sm text-slate-500 text-center py-8">
              Search the Spotify catalog and import tracks into your library. Log in to Spotify in this browser for full-track playback in the embeds.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}