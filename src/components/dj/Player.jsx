import React, { useState } from 'react';
import { useDj } from '@/lib/DjContext';
import { usePlaylists, useSongs } from '@/hooks/useDjData';
import { formatTime } from '@/lib/audio';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Waves, Siren, ChevronDown } from 'lucide-react';

function SeekBar({ time, duration, start, onSeek, className }) {
  const progress = duration > 0 ? Math.min(100, Math.max(0, time / duration * 100)) : 0;
  const seekAtPointer = (event) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    if (width > 0) onSeek(Math.min(1, Math.max(0, (event.clientX - left) / width)) * duration);
  };

  return (
    <div className={`group relative flex h-7 items-center ${className}`}>
      <div aria-hidden="true" className="pointer-events-none relative h-0.5 w-full rounded-full bg-border group-focus-within:ring-1 group-focus-within:ring-ring">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary/80" style={{ width: `${progress}%` }} />
        {start > 0 && start < duration && (
          <span className="absolute -top-px h-1 w-px bg-muted-foreground" style={{ left: `${start / duration * 100}%` }} />
        )}
        {duration > 0 && (
          <span className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary transition-[width,height] group-hover:h-2 group-hover:w-2 group-focus-within:h-2 group-focus-within:w-2"
            style={{ left: `${progress}%` }} />
        )}
      </div>
      <input
        type="range" min={0} max={duration || 0} step="any" value={duration > 0 ? progress / 100 * duration : 0}
        onChange={event => onSeek(Number(event.target.value))}
        onPointerDown={event => {
          if (!duration || event.button !== 0 || !event.isPrimary) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          seekAtPointer(event);
        }}
        onPointerMove={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAtPointer(event);
        }}
        disabled={!duration}
        aria-label="Playback position"
        aria-valuetext={formatTime(time)}
        className="absolute inset-0 m-0 w-full touch-none cursor-grab opacity-0 active:cursor-grabbing disabled:cursor-default"
      />
    </div>
  );
}

// Persistent bottom player bar: 72px tall on desktop, hairline top border, no shadow.
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

  return (
    <div className="shrink-0 border-t border-border bg-card px-4 md:px-8 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:min-h-[72px] md:pt-0 md:pb-0 md:flex md:flex-col md:justify-center">
      {playbackError && <p role="alert" className="text-xs text-destructive py-1">{playbackError}</p>}
      <SeekBar className="-mt-2 lg:hidden" time={dj.currentTime} duration={song ? dj.duration : 0}
        start={song?.start_point} onSeek={dj.seek} />

      {song && <p className="mb-1 truncate text-sm font-medium sm:hidden">{song.title}</p>}
      <div className="flex w-full min-w-0 items-center justify-between gap-1.5 md:gap-4">
        <div className="hidden sm:block min-w-0 w-36 lg:w-52 shrink-0">
          <p className="truncate text-[15px] font-semibold leading-tight">{song?.title || 'Nothing loaded'}</p>
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
            className="w-12 h-12 md:w-11 md:h-11 shrink-0 rounded-[10px] bg-primary text-primary-foreground flex items-center justify-center transition-transform active:scale-[0.96] hover:bg-primary/90"
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
          <SeekBar className="min-w-0 flex-1" time={dj.currentTime} duration={song ? dj.duration : 0}
            start={song?.start_point} onSeek={dj.seek} />
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
                <div className="absolute bottom-full mb-2 right-0 w-[min(280px,calc(100vw_-_5rem))] max-h-[min(20rem,55dvh)] overflow-y-auto bg-popover border border-border rounded-[10px] shadow-[0_16px_40px_rgba(0,0,0,0.5)] py-1 z-50">
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
