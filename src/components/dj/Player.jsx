import React from 'react';
import { useDj } from '@/lib/DjContext';
import { formatTime } from '@/lib/audio';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Waves, Siren } from 'lucide-react';

export default function Player() {
  const dj = useDj();
  const song = dj.currentSong;

  if (!song) {
    return (
      <div className="sticky bottom-0 z-20 border-t border-slate-800 bg-slate-900/80 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-center text-sm text-slate-500">
          <Waves className="w-4 h-4 mr-2" /> No track loaded — add one to the queue.
        </div>
      </div>
    );
  }

  const remaining = dj.duration ? Math.max(0, dj.duration - dj.currentTime) : 0;
  const pct = dj.duration ? (dj.currentTime / dj.duration) * 100 : 0;

  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-800 bg-slate-900/90 backdrop-blur px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="hidden sm:block min-w-0 w-48">
          <p className="truncate font-medium text-sm">{song.title}</p>
          <p className="truncate text-xs text-slate-400">{song.artist || 'Unknown'}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={dj.prev} aria-label="Previous track" className="p-2 rounded-full hover:bg-slate-800 text-slate-300" title="Previous">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={dj.isPlaying ? dj.pause : dj.play}
            aria-label={dj.isPlaying ? 'Pause' : 'Play'}
            className="w-11 h-11 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center hover:bg-cyan-300 transition"
          >
            {dj.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>
          <button onClick={dj.next} aria-label="Next track" className="p-2 rounded-full hover:bg-slate-800 text-slate-300" title="Next">
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-slate-400 tabular-nums w-10 text-right">{formatTime(dj.currentTime)}</span>
          <div
            className="relative flex-1 h-1.5 rounded-full bg-slate-800 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const frac = (e.clientX - rect.left) / rect.width;
              dj.seek(frac * (dj.duration || 0));
            }}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-cyan-400" style={{ width: `${pct}%` }} />
            {song.start_point > 0 && (
              <div
                className="absolute -top-1 w-0.5 h-3.5 bg-emerald-400"
                style={{ left: `${(song.start_point / (dj.duration || 1)) * 100}%` }}
              />
            )}
          </div>
          <span className="text-xs text-slate-500 tabular-nums w-12">{formatTime(remaining)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => (dj.goalPlaying ? dj.stopGoal() : dj.fadeOut(2, false))}
            disabled={dj.isFading || (!dj.isPlaying && !dj.goalPlaying)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            title={dj.goalPlaying ? 'Fade out goal horn' : 'Fade out & pause'}
          >
            <Waves className="w-3.5 h-3.5" /> Fade
          </button>
          <button
            onClick={dj.triggerGoal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition shadow"
            title="Goal! Play the goal horn and music"
          >
            <Siren className="w-3.5 h-3.5" /> Goal
          </button>
          <button
            onClick={() => dj.setMasterVolume(dj.masterVolume > 0 ? 0 : 1)}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-300"
          >
            {dj.masterVolume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={dj.masterVolume}
            onChange={(e) => dj.setMasterVolume(Number(e.target.value))}
            className="w-20 accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
}