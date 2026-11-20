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
      <div className="shrink-0 border-t border-border bg-card px-4 md:px-8 py-3 md:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          Nothing loaded — add a track to the queue.
        </div>
      </div>
    );
  }

  const remaining = dj.duration ? Math.max(0, dj.duration - dj.currentTime) : 0;
  const pct = dj.duration ? (dj.currentTime / dj.duration) * 100 : 0;

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 md:px-8 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4">
      <div className="flex items-center gap-3 md:gap-6">
        <div className="hidden sm:block min-w-0 w-48 lg:w-64 shrink-0">
          <p className="truncate text-[16px] font-semibold leading-tight">{song.title}</p>
          <p className="truncate text-[13px] text-muted-foreground">{song.artist || 'Unknown'}</p>
        </div>

        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <button
            onClick={dj.prev}
            aria-label="Previous track"
            title="Previous"
            className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <SkipBack className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={dj.isPlaying ? dj.pause : dj.play}
            aria-label={dj.isPlaying ? 'Pause' : 'Play'}
            className="w-[52px] h-[52px] shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-transform active:scale-[0.96] hover:bg-primary/90"
          >
            {dj.isPlaying ? <Pause className="w-5 h-5 fill-current" aria-hidden="true" /> : <Play className="w-5 h-5 fill-current" aria-hidden="true" />}
          </button>
          <button
            onClick={dj.next}
            aria-label="Next track"
            title="Next"
            className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <SkipForward className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
          <span className="hidden sm:inline font-display text-[15px] font-medium tabular-nums w-10 text-right text-foreground">
            {formatTime(dj.currentTime)}
          </span>
          <div
            className="relative flex-1 h-1 rounded-full bg-border cursor-pointer group"
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
          <span className="hidden sm:inline font-display text-[15px] font-medium tabular-nums w-12 text-muted-foreground">
            -{formatTime(remaining)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <button
            onClick={() => (dj.goalPlaying ? dj.stopGoal() : dj.fadeOut(2, false))}
            disabled={dj.isFading || (!dj.isPlaying && !dj.goalPlaying)}
            className="hidden sm:flex items-center gap-1.5 min-h-11 px-3 rounded-[10px] border border-border text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
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
              className="flex items-center gap-1.5 min-h-11 px-3 rounded-l-[10px] text-[13px] font-bold uppercase tracking-[0.1em] bg-signal text-signal-foreground hover:bg-signal/90 transition-colors"
              title={defaultPl ? `Goal! Horn + shuffle "${defaultPl.name}"` : 'Goal! Play the goal horn'}
              aria-label={defaultPl ? `Goal horn then ${defaultPl.name}` : 'Play goal horn'}
            >
              <Siren className="w-3.5 h-3.5" aria-hidden="true" /> Goal
            </button>
            <button
              onClick={() => setGoalMenuOpen((o) => !o)}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-r-[10px] bg-signal text-signal-foreground hover:bg-signal/90 transition-colors border-l border-signal-foreground/20"
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
            className="min-h-11 min-w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
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
            className="hidden lg:block w-24 accent-primary"
            aria-label="Master volume"
          />
        </div>
      </div>
    </div>
  );
}