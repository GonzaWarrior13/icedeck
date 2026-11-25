import React, { useState } from 'react';
import { useDj } from '@/lib/DjContext';
import { usePlaylists, useSongs } from '@/hooks/useDjData';
import { formatTime } from '@/lib/audio';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Waves, Siren, ChevronDown } from 'lucide-react';

// Keep transport controls anchored below the scrollable workspace.
export default function Player() {
  const dj = useDj();
  const { data: playlists = [] } = usePlaylists();
  const { data: librarySongs = [] } = useSongs();
  const [goalMenuOpen, setGoalMenuOpen] = useState(false);

  const goalWithPlaylist = (pl) => {
    setGoalMenuOpen(false);
    const songs = (pl.song_ids || []).map((id) => librarySongs.find((s) => s.id === id)).filter(Boolean);
    // Pass the setlist ID so the goal sequence uses the no-repeat shuffle bag.
    dj.triggerGoal(songs, 0, pl.id);
  };

  const goalOnly = () => {
    setGoalMenuOpen(false);
    dj.triggerGoal();
  };

  const defaultPl = playlists.find((p) => p.id === dj.goalSetlistId);
  const song = dj.currentSong;
  const playbackError = dj.playbackError;

  const remaining = dj.duration ? Math.max(0, dj.duration - dj.currentTime) : 0;
  const pct = dj.duration ? (dj.currentTime / dj.duration) * 100 : 0;

  return (
    <div className="shrink-0 border-t border-border bg-card px-4 md:px-8 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:min-h-[80px] md:pt-0 md:pb-0 md:flex md:flex-col md:justify-center">
      {playbackError && <p role="alert" className="text-xs text-destructive py-1">{playbackError}</p>}
      <div
        className="relative -mx-4 mb-2 h-1 cursor-pointer bg-border lg:hidden"
        onClick={(e) => {
          if (!song) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          dj.seek(frac * (dj.duration || 0));
        }}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(dj.duration || 0)}
        aria-valuenow={Math.round(dj.currentTime || 0)}
      >
        <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct}%` }} />
      </div>

      {song && <p className="mb-1 truncate text-sm font-medium sm:hidden">{song.title}</p>}
      <div className="flex w-full min-w-0 items-center justify-between gap-1.5 md:gap-4">
        <div className="hidden sm:block min-w-0 w-36 lg:w-52 shrink-0">
          <p className="truncate text-[15px] font-semibold leading-tight">{song?.title || 'No track loaded'}</p>
          <p className="truncate type-meta">{song && (song.artist || 'Unknown')}</p>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
          <button
            onClick={dj.prev}
            disabled={!song}
            aria-label="Previous track"
            title="Previous track"
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:h-10 md:w-10"
          >
            <SkipBack className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={dj.isPlaying ? dj.pause : dj.play}
            disabled={!song}
            aria-label={dj.isPlaying ? 'Pause' : 'Play'}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors enabled:hover:bg-primary/90 enabled:active:scale-[0.96] disabled:bg-secondary disabled:text-muted-foreground md:h-11 md:w-11"
          >
            {dj.isPlaying ? <Pause className="w-5 h-5 fill-current" aria-hidden="true" /> : <Play className="w-5 h-5 fill-current" aria-hidden="true" />}
          </button>
          <button
            onClick={dj.next}
            disabled={!song}
            aria-label="Next track"
            title="Next track"
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:h-10 md:w-10"
          >
            <SkipForward className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-2.5 lg:flex">
          <span className="type-data w-11 shrink-0 text-right text-foreground">
            {formatTime(dj.currentTime)}
          </span>
          <div
            className="relative flex-1 h-1 rounded-full bg-border cursor-pointer transition-all hover:h-1.5"
            onClick={(e) => {
              if (!song) return;
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
            {song?.start_point > 0 && (
              <div
                className="absolute -top-1.5 w-0.5 h-4 bg-primary"
                style={{ left: `${(song.start_point / (dj.duration || 1)) * 100}%` }}
              />
            )}
          </div>
          <span className="type-data w-12 shrink-0 text-muted-foreground">
            -{formatTime(remaining)}
          </span>
        </div>

        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <button
            onClick={() => (dj.goalPlaying ? dj.stopGoal() : dj.fadeOut(2, false))}
            disabled={dj.isFading || (!dj.isPlaying && !dj.goalPlaying)}
            className={`hidden sm:flex items-center gap-1.5 h-10 px-2.5 rounded-[8px] border-[1.5px] text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-40 ${
              dj.isFading
                ? 'border-destructive bg-destructive text-destructive-foreground'
                : 'border-destructive/70 text-destructive hover:bg-destructive/10'
            }`}
            title={dj.goalPlaying ? 'Fade out goal horn' : 'Fade out and pause the track'}
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
              className="flex items-center gap-1.5 h-11 px-2.5 rounded-l-[8px] text-[12px] font-bold uppercase tracking-[0.08em] bg-signal text-signal-foreground hover:bg-signal/90 transition-colors"
              title={defaultPl ? `Play the horn, then shuffle ${defaultPl.name}` : 'Play the goal horn'}
              aria-label={defaultPl ? `Goal horn then ${defaultPl.name}` : 'Play goal horn'}
            >
              <Siren className="w-3.5 h-3.5" aria-hidden="true" /> Goal
            </button>
            <button
              onClick={() => setGoalMenuOpen((o) => !o)}
              className="flex h-11 w-11 items-center justify-center rounded-r-[8px] bg-signal text-signal-foreground hover:bg-signal/90 transition-colors border-l border-signal-foreground/20"
              title="More goal options"
              aria-label="More goal options"
              aria-expanded={goalMenuOpen}
            >
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
            {goalMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setGoalMenuOpen(false)} aria-hidden="true" />
                <div className="absolute bottom-full mb-2 right-0 w-[min(280px,calc(100vw_-_5rem))] max-h-[min(20rem,55dvh)] overflow-y-auto bg-popover border border-border rounded-xl shadow-sm py-1 z-50">
                  <button
                    onClick={goalOnly}
                    className="w-full text-left min-h-11 px-3 py-2 text-sm text-popover-foreground hover:bg-secondary transition-colors"
                  >
                    Horn only
                  </button>
                  {playlists.length > 0 && (
                    <div className="px-3 pt-2 pb-1 section-label">Shuffle after the horn</div>
                  )}
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => goalWithPlaylist(pl)}
                      className="w-full text-left min-h-11 px-3 py-2 text-sm text-muted-foreground hover:text-popover-foreground hover:bg-secondary truncate transition-colors"
                    >
                      {pl.name}
                    </button>
                  ))}
                  {playlists.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Create a setlist to play music after the horn.</div>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => dj.setMasterVolume(dj.masterVolume > 0 ? 0 : 1)}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:h-10 md:w-9"
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
            className="hidden xl:block w-20 accent-primary"
            aria-label="Master volume"
          />
        </div>
      </div>
    </div>
  );
}
