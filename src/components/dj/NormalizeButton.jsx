import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Volume2 } from 'lucide-react';
import { SONGS_KEY, useSongs } from '@/hooks/useDjData';
import { analyzeLoudness, referenceDb, volumeForDb } from '@/lib/audio';

// Measures every track once, then stores the per-track volume that levels the
// whole library so the master slider can stay put during a game.
export default function NormalizeButton() {
  const { data: songs = [] } = useSongs();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const normalize = async () => {
    const tracks = songs.filter((s) => s.file_url || s.preview_url);
    if (!tracks.length) return;
    setRunning(true);
    setError('');
    try {
      const levels = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        setStatus(`Checking ${i + 1}/${tracks.length}`);
        let db = typeof track.loudness_db === 'number' ? track.loudness_db : null;
        if (db == null) {
          try {
            db = await analyzeLoudness(track.preview_url || track.file_url);
          } catch {
            db = null; // a file we cannot decode keeps the volume it has
          }
        }
        levels.push({ id: track.id, db });
      }
      const ref = referenceDb(levels.map((l) => l.db));
      const changes = levels
        .filter((l) => l.db != null)
        .map((l) => ({ id: l.id, volume: volumeForDb(l.db, ref), loudness_db: Math.round(l.db * 10) / 10 }));
      for (let i = 0; i < changes.length; i += 200) {
        await base44.entities.Song.bulkUpdate(changes.slice(i, i + 200));
      }
      const byId = new Map(changes.map((c) => [c.id, c]));
      queryClient.setQueryData(SONGS_KEY, (prev = []) => prev.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s)));
      setStatus(`Leveled ${changes.length} track${changes.length === 1 ? '' : 's'}`);
    } catch (e) {
      setError(e.message || 'Could not level the library');
      setStatus('');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={normalize}
        disabled={running || !songs.length}
        className="flex items-center gap-1.5 min-h-9 px-2.5 rounded-[10px] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-[13px] font-medium disabled:opacity-40 md:min-h-10 md:gap-2 md:px-3.5 md:text-sm"
      >
        {running ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin md:w-4 md:h-4" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
        )}
        <span className="md:hidden">{running ? 'Leveling…' : 'Level'}</span>
        <span className="hidden md:inline">{running ? 'Normalizing…' : 'Normalize volume'}</span>
      </button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}