import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOAL_HORN_URL = 'https://media.base44.com/files/public/6a8f48cd9a055819d8b79b87/d73c0e5ef_TorontoMapleLeafsGoalHornNoSong.mp3';

const defaultDj = {
  queue: [], currentIndex: -1, currentSong: null, isPlaying: false,
  currentTime: 0, duration: 0, masterVolume: 1, isFading: false, audio: null,
  goalPlaying: false,
  play() {}, pause() {}, next() {}, prev() {}, seek() {}, setMasterVolume() {},
  fadeOut() {}, triggerGoal() {}, stopGoal() {},
  addToQueue() {}, addManyToQueue() {}, removeFromQueue() {}, reorderQueue() {},
  clearQueue() {}, playNow() {}, playQueueFrom() {},
};
const DjContext = createContext(defaultDj);
export const useDj = () => useContext(DjContext);

export function DjProvider({ children }) {
  const audioRef = useRef(null);
  if (typeof Audio !== 'undefined' && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const audio = audioRef.current;
  const prefetchRef = useRef(null);
  const goalAudioRef = useRef(null);

  const [queue, setQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dj_queue') || '[]'); } catch { return []; }
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    try { const v = Number(localStorage.getItem('dj_index')); return Number.isFinite(v) ? v : -1; } catch { return -1; }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [isFading, setIsFading] = useState(false);
  const [goalPlaying, setGoalPlaying] = useState(false);
  const [goalSetlistId, setGoalSetlistIdState] = useState(() => {
    try { return localStorage.getItem('dj_goalSetlistId') || null; } catch { return null; }
  });
  const setGoalSetlist = useCallback((id) => {
    setGoalSetlistIdState(id);
    try { if (id) localStorage.setItem('dj_goalSetlistId', id); else localStorage.removeItem('dj_goalSetlistId'); } catch {}
  }, []);

  const queueRef = useRef([]);
  const indexRef = useRef(-1);
  const goalTimerRef = useRef(null);
  const playQueueFromRef = useRef(() => {});
  const fadeOutRef = useRef(() => {});
  const hotkeysRef = useRef({});
  const goalSetlistIdRef = useRef(null);
  useEffect(() => { goalSetlistIdRef.current = goalSetlistId; }, [goalSetlistId]);
  const [hotkeyVersion, setHotkeyVersion] = useState(0);
  const refreshHotkeys = useCallback(() => setHotkeyVersion((v) => v + 1), []);

  // load playlists + songs and build a hotkey -> resolved songs map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pls, sgs] = await Promise.all([
          base44.entities.Playlist.list('-updated_date', 100),
          base44.entities.Song.list('-updated_date', 200),
        ]);
        if (cancelled) return;
        const byId = new Map(sgs.map((s) => [s.id, s]));
        const map = {};
        pls.forEach((pl) => {
          if (!pl.hotkey) return;
          const songs = (pl.song_ids || []).map((id) => byId.get(id)).filter(Boolean);
          if (songs.length) map[pl.hotkey] = { songs, playlistId: pl.id };
        });
        hotkeysRef.current = map;
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [hotkeyVersion]);
  useEffect(() => { queueRef.current = queue; try { localStorage.setItem('dj_queue', JSON.stringify(queue)); } catch {} }, [queue]);
  useEffect(() => { indexRef.current = currentIndex; try { localStorage.setItem('dj_index', String(currentIndex)); } catch {} }, [currentIndex]);

  const currentSong = currentIndex >= 0 ? queue[currentIndex] : null;

  const applyVolume = useCallback(() => {
    const sv = currentSong && currentSong.volume != null ? currentSong.volume / 100 : 1;
    const vol = Math.min(1, Math.max(0, sv * masterVolume));
    if (audio) audio.volume = vol;
  }, [audio, currentSong, masterVolume]);

  useEffect(() => { applyVolume(); }, [applyVolume]);

  // prefetch the next queued track so it starts instantly when the user advances
  const prefetchNext = useCallback(() => {
    const q = queueRef.current;
    const ni = indexRef.current + 1;
    const nextSong = ni < q.length ? q[ni] : null;
    if (!nextSong) return;
    const url = nextSong.preview_url || nextSong.file_url;
    if (!url) return;
    if (!prefetchRef.current && typeof Audio !== 'undefined') {
      prefetchRef.current = new Audio();
    }
    const p = prefetchRef.current;
    if (!p) return;
    if (p.src !== url) {
      p.preload = 'auto';
      p.src = url;
      p.load();
    }
  }, []);
  useEffect(() => { prefetchNext(); }, [queue, currentIndex, prefetchNext]);

  // restore the audio source on reload so the saved queue can resume
  useEffect(() => {
    if (!audio) return;
    const song = queue[currentIndex];
    if (!song) return;
    const url = song.preview_url || song.file_url;
    if (url) { audio.src = url; }
    prefetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playIndex = useCallback((index) => {
    const q = queueRef.current;
    if (index < 0 || index >= q.length) return;
    const song = q[index];
    setCurrentIndex(index);
    setCurrentTime(0);
    if (song.id) {
      base44.entities.Song.update(song.id, { play_count: (song.play_count || 0) + 1 }).catch(() => {});
    }
    if (!audio) return;
    const url = song.preview_url || song.file_url;
    if (!url) return;
    audio.src = url;
    audio.play().catch(() => {});
    const start = song.start_point || 0;
    if (start > 0) {
      const onMeta = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        if (start < (audio.duration || 0)) audio.currentTime = start;
      };
      audio.addEventListener('loadedmetadata', onMeta);
    }
    prefetchNext();
  }, [audio]);

  const nextRef = useRef(() => {});
  nextRef.current = () => {
    const q = queueRef.current;
    const ni = indexRef.current + 1;
    if (ni < q.length) playIndex(ni);
    else {
      if (audio) audio.pause();
      setIsPlaying(false);
    }
  };

  const play = useCallback(() => { audio?.play().catch(() => {}); }, [audio]);
  const pause = useCallback(() => { fadeOutRef.current(2, false); }, []);
  const next = useCallback(() => nextRef.current(), []);
  const prev = useCallback(() => {
    const pi = indexRef.current - 1;
    if (pi >= 0) playIndex(pi);
  }, [playIndex]);

  const seek = useCallback((t) => { if (audio) audio.currentTime = t; setCurrentTime(t); }, [audio]);
  const setMasterVolume = useCallback((v) => setMasterVolumeState(v), []);

  const fadeOut = useCallback((sec = 2, thenNext = true) => {
    if (isFading || !audio) return;
    setIsFading(true);
    const sv = currentSong && currentSong.volume != null ? currentSong.volume / 100 : 1;
    const startVol = Math.min(1, Math.max(0, sv * masterVolume)) || 1;
    const t0 = performance.now();
    const step = () => {
      const frac = Math.min(1, (performance.now() - t0) / (sec * 1000));
      audio.volume = startVol * (1 - frac);
      if (frac < 1) requestAnimationFrame(step);
      else {
        audio.pause();
        audio.volume = startVol;
        setIsFading(false);
        if (thenNext) next();
      }
    };
    requestAnimationFrame(step);
  }, [audio, currentSong, isFading, masterVolume, next]);
  fadeOutRef.current = fadeOut;

  const triggerGoal = useCallback((queueSongs, startIndex) => {
    audio?.pause();
    setIsPlaying(false);
    if (goalTimerRef.current) { clearTimeout(goalTimerRef.current); goalTimerRef.current = null; }
    if (queueSongs && queueSongs.length) {
      const songs = queueSongs;
      const idx = startIndex ?? 0;
      goalTimerRef.current = setTimeout(() => {
        goalTimerRef.current = null;
        playQueueFromRef.current(songs, idx);
      }, 4000);
    }
    let ga = goalAudioRef.current;
    if (!ga) {
      ga = typeof Audio !== 'undefined' ? new Audio(GOAL_HORN_URL) : null;
      if (ga) { ga.volume = 1; goalAudioRef.current = ga; }
    }
    if (ga) {
      if (!ga._wired) {
        ga.addEventListener('ended', () => setGoalPlaying(false));
        ga.addEventListener('pause', () => setGoalPlaying(false));
        ga._wired = true;
      }
      try { ga.currentTime = 0; } catch (_) {}
      ga.volume = 1;
      ga.play().catch(() => {});
      setGoalPlaying(true);
    }
  }, [audio]);

  const stopGoal = useCallback((sec = 1.5) => {
    const ga = goalAudioRef.current;
    if (!ga || ga.paused) return;
    const startVol = ga.volume || 1;
    const t0 = performance.now();
    const step = () => {
      const frac = Math.min(1, (performance.now() - t0) / (sec * 1000));
      ga.volume = startVol * (1 - frac);
      if (frac < 1) requestAnimationFrame(step);
      else { ga.pause(); try { ga.currentTime = 0; } catch (_) {} ga.volume = startVol; if (goalTimerRef.current) { clearTimeout(goalTimerRef.current); goalTimerRef.current = null; } setGoalPlaying(false); }
    };
    requestAnimationFrame(step);
  }, []);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // drop focus from any clicked control so the key acts on the player, not the button
      const dropFocus = () => {
        const ae = document.activeElement;
        if (ae && ae !== document.body) ae.blur();
      };
      const normKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const entry = hotkeysRef.current[normKey];
      if (entry) {
        e.preventDefault();
        dropFocus();
        const weighted = entry.songs.map((song) => ({ song, count: song.play_count || 0, rand: Math.random() }));
        weighted.sort((a, b) => a.count - b.count || a.rand - b.rand);
        const shuffled = weighted.map((w) => w.song);
        if (entry.playlistId && entry.playlistId === goalSetlistIdRef.current) {
          const startIdx = shuffled.length ? Math.floor(Math.random() * shuffled.length) : 0;
          triggerGoal(shuffled, startIdx);
        } else {
          playQueueFromRef.current(shuffled, 0);
        }
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        dropFocus();
        if (goalPlaying) { stopGoal(); return; }
        if (isPlaying) pause();
        else if (currentSong) play();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        dropFocus();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        dropFocus();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, currentSong, goalPlaying, play, pause, next, prev, stopGoal]);

  // html audio listeners
  useEffect(() => {
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      const song = queueRef.current[indexRef.current];
      if (song && song.end_point && audio.currentTime >= song.end_point) next();
    };
    const onDur = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => next();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('durationchange', onDur);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('durationchange', onDur);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio, next]);

  // queue ops
  const addToQueue = useCallback((song) => setQueue((q) => [...q, song]), []);
  const addManyToQueue = useCallback((songs) => setQueue((q) => [...q, ...songs]), []);
  const removeFromQueue = useCallback((idx) => {
    setQueue((q) => q.filter((_, i) => i !== idx));
    setCurrentIndex((ci) => (ci === idx ? -1 : ci > idx ? ci - 1 : ci));
  }, []);
  const reorderQueue = useCallback((newQueue) => setQueue(newQueue), []);
  const clearQueue = useCallback(() => {
    audio?.pause();
    setQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
  }, [audio]);
  const playNow = useCallback((song) => {
    queueRef.current = [song];
    setQueue([song]);
    setCurrentIndex(-1);
    playIndex(0);
  }, [playIndex]);
  const playQueueFrom = useCallback((songs, idx = 0) => {
    queueRef.current = songs;
    setQueue(songs);
    setCurrentIndex(-1);
    playIndex(idx);
  }, [playIndex]);
  playQueueFromRef.current = playQueueFrom;

  const value = {
    queue, currentIndex, currentSong, isPlaying, currentTime, duration,
    masterVolume, isFading, audio, goalPlaying, goalSetlistId, setGoalSetlist, refreshHotkeys,
    play, pause, next, prev, seek, setMasterVolume, fadeOut, triggerGoal, stopGoal,
    addToQueue, addManyToQueue, removeFromQueue, reorderQueue, clearQueue, playNow, playQueueFrom,
  };
  return <DjContext.Provider value={value}>{children}</DjContext.Provider>;
}