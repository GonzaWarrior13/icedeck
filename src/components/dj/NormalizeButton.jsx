import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { updateTeamSong, createPrivateAudioUrl, getFreshPreviewToken } from '@/api/supabaseClient';
import { Loader2, Volume2 } from 'lucide-react';
import { SONGS_KEY, useSongs, updateMigrationSong } from '@/hooks/useDjData';
import { analyzeLoudness, referenceDb, volumeForDb } from '@/lib/audio';

// Measures every track once, then stores the per-track volume that levels the
// whole library so the master slider can stay put during a game.
export default function NormalizeButton({ useSupabase = false }) {
  const { data: songs = [] } = useSongs();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const normalize = async () => {
    const tracks = songs.filter((s) => s.storage_path || s.file_url);
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
            const url = useSupabase && track.storage_path
              ? await createPrivateAudioUrl(track.storage_path, await getFreshPreviewToken(), 3600)
              : track.file_url;
            db = await analyzeLoudness(url);
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
      if (useSupabase) {
        // Never invoke Base44 for Supabase teams. Save each track through the
        // existing scoped Supabase API and keep the migration cache in sync.
        for (let i = 0; i < changes.length; i++) {
          setStatus(`Saving ${i + 1}/${changes.length}`);
          const { id, ...patch } = changes[i];
          const updated = await updateTeamSong(await getFreshPreviewToken(), id, patch);
          if (!Array.isArray(updated) || updated.length !== 1) throw new Error('Could not update track ' + id + '. Check team permissions.');
          updateMigrationSong(updated[0]);
          queryClient.setQueryData(SONGS_KEY, (prev = []) => prev.map((s) =>
            s.id === id ? { ...s, ...updated[0] } : s
          ));
        }
      } else {
        for (let i = 0; i < changes.length; i += 200) {
          await base44.entities.Song.bulkUpdate(changes.slice(i, i + 200));
        }
      }
      const byId = new Map(changes.map((c) => [c.id, c]));
      if (!useSupabase) queryClient.setQueryData(SONGS_KEY, (prev = []) => prev.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s)));
      else queryClient.invalidateQueries({ queryKey: SONGS_KEY });
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