import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2, Loader2, Plus, X, Music2, Trash2 } from 'lucide-react';

export default function SpotifyBrowser({ open, onOpenChange, onImported }) {
  const [url, setUrl] = useState('');
  const [loaded, setLoaded] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(new Set());

  useEffect(() => {
    if (!open) {
      setLoaded([]);
      setUrl('');
      setError('');
      setImportedIds(new Set());
    }
  }, [open]);

  const loadLink = async (e) => {
    e?.preventDefault();
    const raw = url.trim();
    if (!raw) return;
    setResolving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('SpotifyResolveLink', { url: raw });
      const item = res.data;
      if (loaded.some((l) => l.type === item.type && l.spotify_id === item.spotify_id)) return;
      setLoaded((prev) => [item, ...prev].slice(0, 12));
      setUrl('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load link');
    } finally {
      setResolving(false);
    }
  };

  const importTrack = async (item) => {
    setImportingId(item.spotify_id);
    try {
      const track = {
        title: item.title || 'Spotify Track',
        artist: '',
        spotify_id: item.spotify_id,
        preview_url: '',
        duration: null
      };
      const res = await base44.functions.invoke('SpotifyImport', { track, tags: [] });
      setImportedIds((prev) => new Set(prev).add(item.spotify_id));
      onImported?.(res.data.song);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  const remove = (item) =>
    setLoaded((prev) => prev.filter((l) => !(l.type === item.type && l.spotify_id === item.spotify_id)));

  if (!open) return null;

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
        <form onSubmit={loadLink} className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a Spotify track, album, or playlist link…"
              className="pl-9 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={resolving || !url.trim()} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950">
            {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Load
          </Button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {loaded.map((item) => {
            const key = `${item.type}-${item.spotify_id}`;
            const imported = importedIds.has(item.spotify_id);
            const embedHeight = item.type === 'track' ? 152 : 380;
            return (
              <div key={key} className="rounded-xl overflow-hidden bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/80">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.album_art ? (
                      <img src={item.album_art} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0">
                        <Music2 className="w-4 h-4 text-slate-500" />
                      </div>
                    )}
                    <span className="text-sm font-medium truncate">{item.title || 'Spotify ' + item.type}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.type === 'track' && (
                      imported ? (
                        <span className="text-xs text-cyan-400 px-2">Imported</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => importTrack(item)}
                          disabled={importingId === item.spotify_id}
                          className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-300"
                        >
                          {importingId === item.spotify_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Import
                        </Button>
                      )
                    )}
                    <button
                      onClick={() => remove(item)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <iframe
                  src={`https://open.spotify.com/embed/${item.type}/${item.spotify_id}`}
                  width="100%"
                  height={embedHeight}
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  title={item.title || 'Spotify embed'}
                />
              </div>
            );
          })}
          {!loaded.length && !error && (
            <p className="text-sm text-slate-500 text-center py-8">
              Paste a Spotify track, album, or playlist link to play it inline. Log in to Spotify in this browser for full-track playback in the embeds.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}