import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { copySharedTeamSong, getSelectedTeamId } from '@/api/supabaseClient';
import { SONGS_KEY, addMigrationSong } from '@/hooks/useDjData';
import { userFacingError } from '@/lib/userFacingError';

const SharedImports = createContext(null);

export const useSharedImports = () => useContext(SharedImports);

export function SharedImportQueue({ teamId, children }) {
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState([]);
  const [count, setCount] = useState({ total: 0, added: 0, failed: 0 });
  const [message, setMessage] = useState('');
  const queue = useRef([]);
  const working = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const isCurrentTeam = () => active.current && getSelectedTeamId() === teamId;
  const updatePending = () => setPendingIds(queue.current.map(song => song.id));

  async function drain() {
    working.current = true;
    try {
      while (queue.current.length && isCurrentTeam()) {
        const song = queue.current[0];
        try {
          const copy = await copySharedTeamSong(song);
          if (!isCurrentTeam()) break;
          addMigrationSong(copy);
          queryClient.setQueryData(SONGS_KEY, (tracks = []) => [copy, ...tracks.filter(track => track.id !== copy.id)]);
          setCount(previous => ({ ...previous, added: previous.added + 1 }));
        } catch (error) {
          if (!isCurrentTeam()) break;
          const existing = error.code === '23505' && error.message.includes('songs_team_shared_source_unique');
          if (existing || error.code === 'audio_upload_incomplete') {
            await queryClient.invalidateQueries({ queryKey: SONGS_KEY });
            if (!isCurrentTeam()) break;
          }
          const explanation = existing
            ? 'Already in your library.'
            : userFacingError(error, 'Check your library before trying again.');
          setMessage(`Couldn’t download “${song.title}”. ${explanation}`);
          setCount(previous => ({ ...previous, failed: previous.failed + 1 }));
        }
        queue.current.shift();
        updatePending();
      }
    } finally {
      working.current = false;
    }
  }

  function enqueue(songs, limit) {
    if (!isCurrentTeam()) return;
    const library = queryClient.getQueryData(SONGS_KEY) ?? [];
    const unavailable = new Set([
      ...queue.current.map(song => song.id),
      ...library.flatMap(song => [song.id, song.shared_source_song_id]),
    ]);
    const spots = limit - library.filter(song => song.shared_source_song_id).length - queue.current.length;
    const newSongs = songs.filter(song => !unavailable.has(song.id)).slice(0, Math.max(0, spots));
    if (!newSongs.length) return;
    if (!working.current) {
      setCount({ total: newSongs.length, added: 0, failed: 0 });
      setMessage('');
    } else {
      setCount(previous => ({ ...previous, total: previous.total + newSongs.length }));
    }
    queue.current.push(...newSongs);
    updatePending();
    if (!working.current) void drain();
  }

  function dismiss() {
    setCount({ total: 0, added: 0, failed: 0 });
    setMessage('');
  }

  return (
    <SharedImports.Provider value={{ pendingIds, count, message, enqueue, dismiss }}>
      {children}
    </SharedImports.Provider>
  );
}

export function SharedImportStatus() {
  const imports = useSharedImports();
  if (!imports?.count.total) return null;
  const { pendingIds, count, message, dismiss } = imports;
  const running = pendingIds.length > 0;
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-2 text-sm md:px-8">
      <div className="min-w-0">
        <p role="status" className="font-medium">
          {running ? `Downloading tracks · ${count.added + count.failed} of ${count.total} processed`
            : `${count.added} downloaded${count.failed ? `, ${count.failed} failed` : ''}`}
        </p>
        {message && <p className="text-xs text-destructive">{message}</p>}
      </div>
      {!running && <button type="button" onClick={dismiss} aria-label="Dismiss download status"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-secondary">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>}
    </div>
  );
}
