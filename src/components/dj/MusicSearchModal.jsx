import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Plus, Play, Pause, Music2 } from 'lucide-react';
import { formatTime } from '@/lib/audio';

export default function MusicSearchModal({ open, onClose, onImported }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(new Set());
  const [previewId, setPreviewId] = useState(null);
  const [previewAudio, setPreviewAudio] = useState(null);

  useEffect(() => {
    if (!open) {
      if (previewAudio) previewAudio.pause();
      setPreviewId(null);
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
    if (previewAudio) previewAudio.pause();
    setPreviewId(null);
    try {
      const res = await base44.functions.invoke('ITunesSearch', { query: q, limit: 25 });
      setResults(res.data.results || []);
      if (!res.data.results?.length) setError('No tracks found. Try another search.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const togglePreview = (track) => {
    if (previewId === track.itunes_id && previewAudio && !previewAudio.paused) {
      previewAudio.pause();
      setPreviewId(null);
      return;
    }
    if (!track.preview_url) return;
    if (previewAudio) previewAudio.pause();
    const audio = new Audio(track.preview_url);
    audio.play().catch(() => {});
    audio.onended = () => setPreviewId(null);
    setPreviewAudio(audio);
    setPreviewId(track.itunes_id);
  };

  const importTrack = async (track) => {
    setImportingId(track.itunes_id);
    try {
      const res = await base44.functions.invoke('ITunesImport', { track, tags: [] });
      setImportedIds((prev) => new Set(prev).add(track.itunes_id));
      onImported?.(res.data.song);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Music2 className="w-5 h-5 text-cyan-400" /> Search Music
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Search the iTunes catalog and import tracks with a 30-second preview into your library.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={doSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tracks or artists…"
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

        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {results.map((t) => {
            const imported = importedIds.has(t.itunes_id);
            const importing = importingId === t.itunes_id;
            const isPreviewing = previewId === t.itunes_id;
            return (
              <div key={t.itunes_id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition">
                <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-slate-800 flex items-center justify-center">
                  {t.album_art ? (
                    <img src={t.album_art} alt={t.album} className="w-full h-full object-cover" />
                  ) : (
                    <Music2 className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-slate-400 truncate">{t.artist}{t.album ? ` · ${t.album}` : ''}</p>
                  <p className="text-[11px] text-slate-500">{formatTime(t.duration)} · 30s preview</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePreview(t)}
                    disabled={!t.preview_url}
                    aria-label={isPreviewing ? 'Stop preview' : 'Play preview'}
                    className="text-slate-300 hover:text-cyan-400"
                  >
                    {isPreviewing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  {imported ? (
                    <span className="text-xs text-cyan-400 px-3 py-2">Imported</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => importTrack(t)}
                      disabled={importing}
                      className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-300"
                    >
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Import
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && !results.length && !error && (
            <p className="text-sm text-slate-500 text-center py-8">Search the catalog to import tracks.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}