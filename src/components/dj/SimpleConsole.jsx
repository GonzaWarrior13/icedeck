import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ListMusic, Loader2, Pause, Play, Shuffle, Siren } from 'lucide-react';
import { useDj } from '@/lib/DjContext';
import { songsQueryOptions, usePlaylists } from '@/hooks/useDjData';
import { useSimpleMode } from '@/lib/simpleMode';

// Game-day console: transport, goal horn, and only the setlists picked in Settings.
export default function SimpleConsole() {
  const dj = useDj();
  const queryClient = useQueryClient();
  const { playlistIds } = useSimpleMode();
  const { data: playlists = [], isLoading } = usePlaylists();
  const [busyId, setBusyId] = useState(null);

  const chosen = playlists.filter((pl) => playlistIds.includes(pl.id));

  const resolveSongs = async (pl) => {
    const all = await queryClient.fetchQuery({ ...songsQueryOptions, staleTime: 0 });
    const byId = new Map(all.map((s) => [s.id, s]));
    return (pl.song_ids || []).map((id) => byId.get(id)).filter(Boolean);
  };

  const shufflePlaylist = async (pl) => {
    setBusyId(pl.id);
    try {
      const songs = await resolveSongs(pl);
      if (songs.length) dj.playSetlist(pl.id, songs);
    } catch {
      /* leave the console as it was */
    } finally {
      setBusyId(null);
    }
  };

  const triggerGoal = async () => {
    const goalPlaylist = playlists.find((pl) => pl.id === dj.goalSetlistId);
    if (!goalPlaylist) {
      dj.triggerGoal();
      return;
    }
    try {
      const songs = await resolveSongs(goalPlaylist);
      if (songs.length) dj.triggerGoal(songs, 0, goalPlaylist.id);
      else dj.triggerGoal();
    } catch {
      dj.triggerGoal();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">IceDeck</h1>
          <p className="truncate text-sm text-muted-foreground">
            {dj.currentSong ? dj.currentSong.title : 'Nothing playing'}
          </p>
        </div>
        <Link
          to="/settings"
          className="shrink-0 min-h-11 px-3 rounded-lg bg-secondary text-sm text-foreground flex items-center"
        >
          Settings
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => (dj.isPlaying ? dj.pause() : dj.play())}
          disabled={!dj.currentSong && !dj.isPlaying}
          className="min-h-20 rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center gap-1 font-semibold disabled:opacity-40 active:scale-[0.99] transition"
          aria-label={dj.isPlaying ? 'Pause' : 'Play'}
        >
          {dj.isPlaying ? <Pause className="w-7 h-7 fill-current" aria-hidden="true" /> : <Play className="w-7 h-7 fill-current" aria-hidden="true" />}
          <span className="text-sm">{dj.isPlaying ? 'Pause' : 'Play'}</span>
        </button>
        <button
          onClick={triggerGoal}
          className="min-h-20 rounded-2xl bg-amber-500 text-slate-950 flex flex-col items-center justify-center gap-1 font-semibold active:scale-[0.99] transition"
          aria-label="Goal horn"
        >
          <Siren className="w-7 h-7" aria-hidden="true" />
          <span className="text-sm">Goal</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-area space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading setlists…
          </div>
        ) : chosen.length === 0 ? (
          <div className="text-center py-8 px-4 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            <ListMusic className="w-5 h-5 mx-auto mb-2 opacity-50" aria-hidden="true" />
            No setlists picked yet. Choose them in Settings.
          </div>
        ) : (
          chosen.map((pl) => (
            <div key={pl.id} className="flex items-center gap-3 p-2 pl-3 rounded-xl bg-card/60 border border-border">
              <span className="flex-1 min-w-0 truncate font-medium text-[15px]">{pl.name}</span>
              <button
                onClick={() => shufflePlaylist(pl)}
                disabled={busyId === pl.id}
                className="shrink-0 min-h-11 min-w-11 rounded-lg bg-secondary text-primary flex items-center justify-center hover:bg-secondary/80 disabled:opacity-60"
                aria-label={`Shuffle ${pl.name}`}
                title={`Shuffle ${pl.name}`}
              >
                {busyId === pl.id
                  ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  : <Shuffle className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}