import React, { useState } from 'react';
import { Youtube, Loader2, X, Link as LinkIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function YouTubeImportButton({ onUploaded }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setUrl(''); setError(''); };

  const handleExtract = async () => {
    setError('');
    if (!url.trim()) { setError('Paste a YouTube link first'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('YouTubeExtract', { url: url.trim() });
      const d = res.data || {};
      if (!d.audioBase64) throw new Error(d.error || 'Extraction returned no audio');

      const bin = atob(d.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const mime = d.mime || 'audio/mp4';
      const ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'm4a' : 'mp3';
      const safe = (d.title || 'track').replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
      const file = new File([bytes], `${safe}.${ext}`, { type: mime });

      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const song = await base44.entities.Song.create({
        title: d.title,
        artist: d.artist,
        duration: d.durationSeconds,
        source: 'youtube',
        file_url,
        start_point: 0,
        volume: 100,
        tags: []
      });
      onUploaded(song);
      reset();
      setOpen(false);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Extraction failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 min-h-11 rounded-lg bg-secondary hover:bg-secondary/80 px-3 py-2 text-sm text-foreground transition"
        aria-expanded={open}
      >
        <Youtube className="w-4 h-4 text-red-500" aria-hidden="true" /> Search YouTube
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-30 rounded-xl border border-border bg-popover shadow-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-popover-foreground">
              <LinkIcon className="w-4 h-4" aria-hidden="true" /> Paste a YouTube link
            </div>
            <button
              onClick={() => { setOpen(false); reset(); }}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Close YouTube import"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            aria-label="YouTube link"
            className="w-full min-h-11 rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleExtract}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Extracting…</> : 'Extract audio'}
          </button>
          <p className="text-[11px] text-muted-foreground">Only extract content you have rights to use. YouTube may block some links.</p>
        </div>
      )}
    </div>
  );
}