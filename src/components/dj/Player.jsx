import React, { useState } from 'react';
import { useDj } from '@/lib/DjContext';
import { usePlaylists, useSongs } from '@/hooks/useDjData';
import { formatTime } from '@/lib/audio';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Waves, Siren, ChevronDown } from 'lucide-react';

export default function Player() {
  const dj = useDj();
  const { data: playlists = [] } = usePlaylists();
  const { data: librarySongs = [] } = useSongs();
  const [goalMenuOpen, setGoalMenuOpen] = useState(false);

  const goalWithPlaylist = (pl) => {
    setGoalMenuOpen(false);
    const songs = (pl.song_ids || []).map((id) => librarySongs.find((s) => s.id === id)).filter(Boolean);
    const startIdx = songs.length ? Math.floor(Math.random() * songs.length) : 0;
    dj.triggerGoal(songs, startIdx);
  };

  const goalOnly = () => {
    setGoalMenuOpen(false);
    dj.triggerGoal();
  };

  const defaultPl = playlists.find((p) => p.id === dj.goalSetlistId);
  const song = dj.currentSong;

  if (!song) {
    return (
      <div className="shrink-0 border-t border-border bg-card/90 backdrop-blur px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Waves className="w-4 h-4 mr-2" aria-hidden="true" /> No track loaded — add one to the queue.
        </div>
      </div>
    );
  }

  const remaining = dj.duration ? Math.max(0, dj.duration - dj.currentTime) : 0;
  const pct = dj.duration ? (dj.currentTime / dj.duration) * 100 : 0;

  return (
    <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur px-3 md:px-4 py-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden sm:block min-w-0 w-48">
          <p className="truncate font-medium text-sm">{song.title}</p>
          <p className="truncate text-sm text-muted-foreground">{song.artist || 'Unknown'}</p>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={dj.prev}
            aria-label="Previous track"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-secondary text-foreground"
            title="Previous"
          >
            <SkipBack className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={dj.isPlaying ? dj.pause : dj.play}
            aria-label={dj.isPlaying ? 'Pause' : 'Play'}
            className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition"
          >
            {dj.isPlaying ? <Pause className="w-5 h-5 fill-current" aria-hidden="true" /> : <Play className="w-5 h-5 fill-current" aria-hidden="true" />}
          </button>
          <button
            onClick={dj.next}
            aria-label="Next track"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-secondary text-foreground"
            title="Next"
          >
            <SkipForward className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-2 md:gap-3">
          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums w-10 text-right">{formatTime(dj.currentTime)}</span>
          <div
            className="relative flex-1 h-1.5 rounded-full bg-secondary cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const frac = (e.clientX - rect.left) / rect.width;
              dj.seek(frac * (dj.duration || 0));
            }}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(dj.duration || 0)}
            aria-valuenow={Math.round(dj.currentTime || 0)}
            tabIndex={0}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
            {song.start_point > 0 && (
              <div
                className="absolute -top-1 w-0.5 h-3.5 bg-emerald-400"
                style={{ left: `${(song.start_point / (dj.duration || 1)) * 100}%` }}
              />
            )}
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums w-12">{formatTime(remaining)}</span>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={() => (dj.goalPlaying ? dj.stopGoal() : dj.fadeOut(2, false))}
            disabled={dj.isFading || (!dj.isPlaying && !dj.goalPlaying)}
            className="hidden sm:flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-xs bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-40"
            title={dj.goalPlaying ? 'Fade out goal horn' : 'Fade out & pause'}
            aria-label={dj.goalPlaying ? 'Fade out goal horn' : 'Fade out and pause'}
          >
            <Waves className="w-3.5 h-3.5" aria-hidden="true" /> Fade
          </button>
          <div className="relative flex items-stretch">
            <button
              onClick={() => {
                const def = playlists.find((p) => p.id === dj.goalSetlistId);
                if (def) goalWithPlaylist(def);
                else goalOnly();
              }}
              className="flex items-center gap-1.5 min-h-11 px-3 rounded-l-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition shadow"
              title={defaultPl ? `Goal! Horn + shuffle "${defaultPl.name}"` : 'Goal! Play the goal horn'}
              aria-label={defaultPl ? `Goal horn then ${defaultPl.name}` : 'Play goal horn'}
            >
              <Siren className="w-3.5 h-3.5" aria-hidden="true" /> Goal
            </button>
            <button
              onClick={() => setGoalMenuOpen((o) => !o)}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-r-lg text-xs font-semibold bg-amber-600 text-slate-950 hover:bg-amber-500 transition shadow border-l border-amber-400/40"
              title="More goal options"
              aria-label="More goal options"
              aria-expanded={goalMenuOpen}
            >
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
            {goalMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setGoalMenuOpen(false)} aria-hidden="true" />
                <div className="absolute bottom-full mb-2 right-0 w-56 max-h-72 overflow-y-auto bg-popover border border-border rounded-lg shadow-xl py-1 z-50">
                  <button onClick={goalOnly} className="w-full text-left min-h-11 px-3 py-2 text-sm text-popover-foreground hover:bg-secondary">Horn only</button>
                  {playlists.length > 0 && (
                    <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Shuffle after horn</div>
                  )}
                  {playlists.map((pl) => (
                    <button key={pl.id} onClick={() => goalWithPlaylist(pl)} className="w-full text-left min-h-11 px-3 py-2 text-sm text-popover-foreground hover:bg-secondary truncate">
                      {pl.name}
                    </button>
                  ))}
                  {playlists.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No setlists yet</div>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => dj.setMasterVolume(dj.masterVolume > 0 ? 0 : 1)}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-secondary text-foreground"
            aria-label={dj.masterVolume > 0 ? 'Mute' : 'Unmute'}
          >
            {dj.masterVolume > 0 ? <Volume2 className="w-4 h-4" aria-hidden="true" /> : <VolumeX className="w-4 h-4" aria-hidden="true" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={dj.masterVolume}
            onChange={(e) => dj.setMasterVolume(Number(e.target.value))}
            className="hidden sm:block w-20 accent-primary"
            aria-label="Master volume"
          />
        </div>
      </div>
    </div>
  );
}