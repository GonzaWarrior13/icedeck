import React, { useState } from 'react';
import { useDj } from '@/lib/DjContext';
import { usePlaylists, useSongs } from '@/hooks/useDjData';
import { formatTime } from '@/lib/audio';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Waves, Siren, ChevronDown } from 'lucide-react';

// Persistent bottom player bar: 72px tall on desktop, hairline top border, no shadow.
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
      <div className="shrink-0 border-t border-border bg-card px-4 md:px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:h-[72px] md:py-0 md:flex md:items-center md:pb-0">
        <div className="flex items-center gap-2.5 type-meta">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          Nothing loaded — add a track to the queue.
        </div>
      </div>
    );
  }

  const remaining = dj.duration ? Math.max(0, dj.duration - dj.currentTime) : 0;
  const pct = dj.duration ? (dj.currentTime / dj.duration) * 100 : 0;

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 md:px-5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:h-[72px] md:pt-0 md:pb-0 md:flex md:items-center">
      <div
        className="relative -mx-3 mb-2 h-1 cursor-pointer bg-border lg:hidden"
        onClick={(e) => {
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

      <div className="flex w-full min-w-0 items-center justify-between gap-2 md:gap-4">
        <div className="hidden sm:block min-w-0 w-36 lg:w-52 shrink-0">
          <p className="truncate text-[15px] font-semibold leading-tight">{song.title}</p>
          <p className="truncate type-meta">{song.artist || 'Unknown'}</p>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
          <button
            onClick={dj.prev}
            aria-label="Previous track"
            title="Previous"
            className="flex h-10 w-10 items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <SkipBack className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={dj.isPlaying ? dj.pause : dj.play}
            aria-label={dj.isPlaying ? 'Pause' : 'Play'}
            className="w-12 h-12 md:w-11 md:h-11 shrink-0 rounded-[10px] bg-primary text-primary-foreground flex items-center justify-center transition-transform active:scale-[0.96] hover:bg-primary/90"
          >
            {dj.isPlaying ? <Pause className="w-5 h-5 fill-current" aria-hidden="true" /> : <Play className="w-5 h-5 fill-current" aria-hidden="true" />}
          </button>
          <button
            onClick={dj.next}
            aria-label="Next track"
            title="Next"
            className="flex h-10 w-10 items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
              className="flex items-center gap-1.5 h-10 px-2.5 rounded-l-[8px] text-[12px] font-bold uppercase tracking-[0.08em] bg-signal text-signal-foreground hover:bg-signal/90 transition-colors"
              title={defaultPl ? `Goal! Horn + shuffle "${defaultPl.name}"` : 'Goal! Play the goal horn'}
              aria-label={defaultPl ? `Goal horn then ${defaultPl.name}` : 'Play goal horn'}
            >
              <Siren className="w-3.5 h-3.5" aria-hidden="true" /> Goal
            </button>
            <button
              onClick={() => setGoalMenuOpen((o) => !o)}
              className="flex h-10 w-9 items-center justify-center rounded-r-[8px] bg-signal text-signal-foreground hover:bg-signal/90 transition-colors border-l border-signal-foreground/20"
              title="More goal options"
              aria-label="More goal options"
              aria-expanded={goalMenuOpen}
            >
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
            {goalMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setGoalMenuOpen(false)} aria-hidden="true" />
                <div className="absolute bottom-full mb-2 right-0 w-[280px] max-h-80 overflow-y-auto bg-popover border border-border rounded-[10px] shadow-[0_16px_40px_rgba(0,0,0,0.5)] py-1 z-50">
                  <button
                    onClick={goalOnly}
                    className="w-full text-left min-h-11 px-3 py-2 text-sm text-popover-foreground hover:bg-secondary transition-colors"
                  >
                    Horn only
                  </button>
                  {playlists.length > 0 && (
                    <div className="px-3 pt-2 pb-1 section-label">Shuffle after horn</div>
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
                    <div className="px-3 py-2 text-xs text-muted-foreground">No setlists yet</div>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => dj.setMasterVolume(dj.masterVolume > 0 ? 0 : 1)}
            className="flex h-10 w-9 items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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