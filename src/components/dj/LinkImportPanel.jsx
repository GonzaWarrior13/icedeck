import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { importTracks } from '@/lib/musicImport';

// Apple Music and YouTube Music: paste a public playlist link and pull its tracklist.
export default function LinkImportPanel({ service, serviceName, placeholder, source, existingSongs = [], onImported }) {
  const [url, setUrl] = useState('');
  const [finding, setFinding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const findTracks = async () => {
    setFinding(true);
    setError('');
    setMessage('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('MusicLinkImport', { service, url: url.trim() });
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not read that playlist');
    } finally {
      setFinding(false);
    }
  };

  const importAll = async () => {
    if (!result) return;
    setImporting(true);
    setError('');
    setMessage('');
    try {
      const added = await importTracks({ tracks: result.tracks, source, existingSongs, onImported });
      setMessage(
        added
          ? `Added ${added} track${added === 1 ? '' : 's'} from ${result.name}.`
          : 'Every track on that playlist is already in your library.',
      );
      setResult(null);
      setUrl('');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setResult(null);
          setMessage('');
        }}
        placeholder={placeholder}
        aria-label={`${serviceName} playlist link`}
        className="w-full min-h-10 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <button
        onClick={findTracks}
        disabled={!url.trim() || finding}
        className="w-full inline-flex items-center justify-center gap-2 min-h-10 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 px-3 text-sm font-semibold transition-colors"
      >
        {finding ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
        {finding ? 'Reading playlist…' : 'Find tracks'}
      </button>

      {result && (
        <div className="rounded-[10px] border border-border p-3 space-y-2">
          <p className="truncate text-sm font-medium">{result.name}</p>
          <p className="text-[11px] text-muted-foreground">{result.tracks.length} tracks found</p>
          <button
            onClick={importAll}
            disabled={importing}
            className="w-full inline-flex items-center justify-center gap-2 min-h-9 rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-3 text-xs font-semibold transition-colors"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
            {importing ? 'Importing…' : 'Add to library'}
          </button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Paste a public playlist link from {serviceName}. Only the tracklist is imported — the audio
        stays in {serviceName}, so these tracks can be planned into setlists but not played.
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-primary">{message}</p>}
    </div>
  );
}