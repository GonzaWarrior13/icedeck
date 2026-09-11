import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/DjContext';
import { formatTime } from '@/lib/audio';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Waves, Siren, ChevronDown } from 'lucide-react';

export default function Player() {
  const dj = useDj();
  const [playlists, setPlaylists] = useState([]);
  const [librarySongs, setLibrarySongs] = useState([]);
  const [goalMenuOpen, setGoalMenuOpen] = useState(false);

  useEffect(() => {
    base44.entities.Playlist.list('-updated_date', 100).then(setPlaylists).catch(() => {});
    base44.entities.Song.list('-updated_date', 200).then(setLibrarySongs).catch(() => {});
  }, []);

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
          <div className="relative flex items-stretch">
            <button
              onClick={() => {
                const def = playlists.find((p) => p.id === dj.goalSetlistId);
                if (def) goalWithPlaylist(def);
                else goalOnly();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition shadow"
              title={defaultPl ? `Goal! Horn + shuffle "${defaultPl.name}"` : 'Goal! Play the goal horn'}
            >
              <Siren className="w-3.5 h-3.5" /> Goal
            </button>
            <button
              onClick={() => setGoalMenuOpen((o) => !o)}
              className="px-1.5 py-1.5 rounded-r-lg text-xs font-semibold bg-amber-600 text-slate-950 hover:bg-amber-500 transition shadow border-l border-amber-400/40"
              title="More goal options"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            {goalMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setGoalMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 right-0 w-56 max-h-72 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                  <button onClick={goalOnly} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700">Horn only</button>
                  {playlists.length > 0 && (
                    <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-slate-500">Shuffle after horn</div>
                  )}
                  {playlists.map((pl) => (
                    <button key={pl.id} onClick={() => goalWithPlaylist(pl)} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 truncate">
                      {pl.name}
                    </button>
                  ))}
                  {playlists.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-500">No setlists yet</div>
                  )}
                </div>
              </>
            )}
          </div>
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