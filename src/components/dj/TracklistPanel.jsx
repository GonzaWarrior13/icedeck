import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { importTracks } from '@/lib/musicImport';

// Amazon Music shares no playlist data, so its tracklist is pasted in by hand.
export default function TracklistPanel({ existingSongs = [], onImported }) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const parseLine = (line) => {
    const cleaned = line.replace(/^\s*\d+[.)]\s*/, '');
    const [title, ...rest] = cleaned.split(/\s+[-–—]\s+/);
    return { title: title || cleaned, artist: rest.join(' - ') };
  };

  const importAll = async () => {
    setImporting(true);
    setError('');
    setMessage('');
    try {
      const added = await importTracks({
        tracks: lines.map(parseLine),
        source: 'amazon',
        existingSongs,
        onImported,
      });
      setMessage(
        added
          ? `Added ${added} track${added === 1 ? '' : 's'} from your Amazon Music list.`
          : 'Every track on that list is already in your library.',
      );
      if (added) setText('');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage('');
        }}
        rows={6}
        placeholder={'Thunderstruck - AC/DC\nEnter Sandman - Metallica'}
        aria-label="Amazon Music tracklist"
        className="w-full rounded-[10px] border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="flex items-center justify-between">
        <span className="type-data text-muted-foreground">{lines.length} lines</span>
        <button
          onClick={importAll}
          disabled={!lines.length || importing}
          className="inline-flex items-center justify-center gap-2 min-h-9 rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 px-3 text-xs font-semibold transition-colors"
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
          {importing ? 'Importing…' : 'Add to library'}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Amazon Music doesn’t share playlist data, so paste the tracklist instead — one track per line
        as Title - Artist. Only the tracklist is imported, so these tracks can be planned into
        setlists but not played.
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-primary">{message}</p>}
    </div>
  );
}