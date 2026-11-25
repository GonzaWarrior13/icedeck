import React from 'react';
import { Link } from 'react-router-dom';
import { ListMusic, Loader2, Pause, Play, Shuffle, Siren } from 'lucide-react';
import { useDj } from '@/lib/DjContext';
import { usePlaylists, useSongs } from '@/hooks/useDjData';
import { useSimpleMode } from '@/lib/simpleMode';

// Game-day console: transport, goal horn, and only the setlists picked in Settings.
export default function SimpleConsole() {
  const dj = useDj();
  const { data: librarySongs = [] } = useSongs();
  const { playlistIds } = useSimpleMode();
  const { data: playlists = [], isLoading } = usePlaylists();

  const chosen = playlists.filter((pl) => playlistIds.includes(pl.id));

  const songsById = new Map(librarySongs.map(song => [song.id, song]));
  const resolveSongs = playlist => (playlist?.song_ids || []).map(id => songsById.get(id)).filter(Boolean);

  const shufflePlaylist = playlist => {
    dj.playSetlist(playlist.id, resolveSongs(playlist));
  };

  const triggerGoal = () => {
    const playlist = playlists.find(pl => pl.id === dj.goalSetlistId);
    dj.triggerGoal(resolveSongs(playlist), 0, playlist?.id);
  };

  return (
    <div className="flex flex-col h-full px-5 md:px-8 py-5 gap-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label">Console</p>
          <p className="mt-1 truncate font-display text-2xl font-semibold leading-none">
            {dj.currentSong ? dj.currentSong.title : 'Nothing playing'}
          </p>
        </div>
        <Link
          to="/settings"
          className="shrink-0 min-h-10 px-3.5 rounded-[10px] border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center transition-colors"
        >
          Settings
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => (dj.isPlaying ? dj.pause() : dj.play())}
          disabled={!dj.currentSong && !dj.isPlaying}
          className="min-h-20 rounded-[14px] bg-primary text-primary-foreground flex flex-col items-center justify-center gap-1.5 font-semibold disabled:opacity-40 active:scale-[0.99] transition"
          aria-label={dj.isPlaying ? 'Pause' : 'Play'}
        >
          {dj.isPlaying ? <Pause className="w-7 h-7 fill-current" aria-hidden="true" /> : <Play className="w-7 h-7 fill-current" aria-hidden="true" />}
          <span className="text-sm">{dj.isPlaying ? 'Pause' : 'Play'}</span>
        </button>
        <button
          onClick={triggerGoal}
          className="min-h-20 rounded-[14px] bg-signal text-signal-foreground flex flex-col items-center justify-center gap-1.5 font-bold uppercase tracking-[0.1em] active:scale-[0.99] transition"
          aria-label="Goal horn"
        >
          <Siren className="w-7 h-7" aria-hidden="true" />
          <span className="text-sm">Goal</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-area">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading setlists…
          </div>
        ) : chosen.length === 0 ? (
          <div className="pt-12 text-center">
            <ListMusic className="w-5 h-5 mx-auto mb-3 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Choose which setlists to show in Settings.</p>
          </div>
        ) : (
          <div className={`grid gap-3 ${chosen.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {chosen.map((pl) => (
              <button
                key={pl.id}
                onClick={() => shufflePlaylist(pl)}
                className="min-h-28 rounded-[14px] bg-secondary px-3 py-4 flex flex-col items-center justify-center gap-1.5 text-center active:scale-[0.99] transition hover:bg-secondary/70"
                aria-label={`Shuffle ${pl.name}`}
              >
                <Shuffle className="w-6 h-6 text-primary" aria-hidden="true" />
                <span className="font-semibold text-base leading-tight line-clamp-2">{pl.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{(pl.song_ids || []).length} tracks</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}