import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPrivateAudioUrl, getFreshPreviewToken } from '@/api/supabaseClient';
import { PLAYLISTS_KEY, playlistsQueryOptions, songsQueryOptions } from '@/hooks/useDjData';

const isSupabasePreview = typeof window !== 'undefined' && ['/supabase-dj','/supabase-original'].includes(window.location.pathname);

// The original Base44 branch still uses its existing sound. Supabase preview
// uses local audio when configured, otherwise generates a temporary horn.
const ORIGINAL_GOAL_HORN_URL = 'https://media.base44.com/files/public/6a8f48cd9a055819d8b79b87/d73c0e5ef_TorontoMapleLeafsGoalHornNoSong.mp3';
const MIGRATION_GOAL_HORN_URL = import.meta.env.VITE_ICEDECK_GOAL_HORN_URL || '/goal-horn.mp3';
const GOAL_HORN_FADE_SECONDS = 1.2;
const GOAL_SONG_EARLY_SECONDS = 0.6;

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
  const queryClient = useQueryClient();
  const audioRef = useRef(null);
  if (typeof Audio !== 'undefined' && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const audio = audioRef.current;
  const playbackRequestRef = useRef(0);
  const [playbackError, setPlaybackError] = useState('');
  const prefetchRef = useRef(null);
  const goalAudioRef = useRef(null);
  const generatedHornRef = useRef(null);
  const goalResumeRef = useRef(null);

  const [queue, setQueue] = useState(() => {
    try { return isSupabasePreview ? [] : JSON.parse(localStorage.getItem('dj_queue') || '[]'); } catch { return []; }
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    try { if (isSupabasePreview) return -1; const v = Number(localStorage.getItem('dj_index')); return Number.isFinite(v) ? v : -1; } catch { return -1; }
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
  const playlistSongsRef = useRef({});
  const goalSetlistIdRef = useRef(null);
  const setlistPlayedRef = useRef({}); // setlistId -> Set of songIds played this cycle
  const setlistLastRef = useRef({}); // setlistId -> last songId played (across cycles)
  const activeSetlistIdRef = useRef(null);
  const playSetlistRef = useRef(() => {});
  useEffect(() => { goalSetlistIdRef.current = goalSetlistId; }, [goalSetlistId]);
  const [hotkeyVersion, setHotkeyVersion] = useState(0);
  const refreshHotkeys = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PLAYLISTS_KEY });
    setHotkeyVersion((v) => v + 1);
  }, [queryClient]);

  // load playlists + songs and build a hotkey -> resolved songs map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pls = await queryClient.fetchQuery(playlistsQueryOptions);
        if (cancelled) return;
        const map = {};
        const songsMap = {};
        pls.forEach((pl) => {
          const ids = pl.song_ids || [];
          if (ids.length) songsMap[pl.id] = ids;
          if (!pl.hotkey) return;
          if (ids.length) map[String(pl.hotkey).toLowerCase()] = { songIds: ids, playlistId: pl.id };
        });
        hotkeysRef.current = map;
        playlistSongsRef.current = songsMap;
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [hotkeyVersion, queryClient]);
  useEffect(() => { queueRef.current = queue; try { if (!isSupabasePreview) localStorage.setItem('dj_queue', JSON.stringify(queue)); } catch {} }, [queue]);
  useEffect(() => { indexRef.current = currentIndex; try { if (!isSupabasePreview) localStorage.setItem('dj_index', String(currentIndex)); } catch {} }, [currentIndex]);

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
    if (isSupabasePreview) return; // Preview signs each new track just before playing it.
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
    const requestId = ++playbackRequestRef.current;
    setCurrentIndex(index);
    indexRef.current = index;
    setCurrentTime(0);
    setPlaybackError('');
    if (song.id) {
      if (!isSupabasePreview) base44.entities.Song.update(song.id, { play_count: (song.play_count || 0) + 1 }).catch(() => {});
      const sid = activeSetlistIdRef.current;
      if (sid) {
        let played = setlistPlayedRef.current[sid];
        if (!played) { played = new Set(); setlistPlayedRef.current[sid] = played; }
        played.add(song.id);
        setlistLastRef.current[sid] = song.id;
      }
    }
    if (!audio) return;

    const startPlayback = (url) => {
      if (requestId !== playbackRequestRef.current) return;
      if (!url) { setPlaybackError('This track has no playable audio.'); return; }
      audio.pause();
      audio.src = url;
      const start = song.start_point || 0;
      if (start > 0) {
        const onMeta = () => {
          audio.removeEventListener('loadedmetadata', onMeta);
          if (requestId !== playbackRequestRef.current) return;
          if (start < (audio.duration || 0)) audio.currentTime = start;
        };
        audio.addEventListener('loadedmetadata', onMeta);
      }
      audio.play().catch((err) => {
        if (requestId === playbackRequestRef.current) setPlaybackError('Playback failed: ' + err.message);
      });
      prefetchNext();
    };
    if (isSupabasePreview && song.storage_path) {
      // Create a fresh signed URL for EACH track switch, even hours after login.
      // Refresh Supabase Auth first when needed. Never persist the signed URL.
      (async () => {
        try {
          const token = await getFreshPreviewToken();
          const signedUrl = await createPrivateAudioUrl(song.storage_path, token, 3600);
          startPlayback(signedUrl);
        } catch (err) {
          if (requestId === playbackRequestRef.current) setPlaybackError('Could not renew private audio: ' + err.message);
        }
      })();
    } else {
      startPlayback(song.preview_url || song.file_url);
    }
  }, [audio, prefetchNext]);

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

  const triggerGoal = useCallback((queueSongs, startIndex, setlistId) => {
    audio?.pause();
    setIsPlaying(false);
    if (goalTimerRef.current) { clearTimeout(goalTimerRef.current); goalTimerRef.current = null; }
    goalResumeRef.current = null;
    if (queueSongs && queueSongs.length) {
      const songs = queueSongs;
      const idx = startIndex ?? 0;
      const resume = () => {
        if (setlistId) {
          // Start a new shuffled selection from the goal playlist immediately
          // after the horn ends; playSetlist also avoids early repeats.
          playSetlistRef.current(setlistId, songs);
        } else {
          playQueueFromRef.current(songs, idx);
        }
      };
      if (isSupabasePreview && MIGRATION_GOAL_HORN_URL) {
        // Crossfade: lower the horn over its final 1.2 seconds and start
        // the shuffled goal setlist 0.6 seconds before its natural end.
        goalResumeRef.current = resume;
      } else {
        goalTimerRef.current = setTimeout(() => {
          goalTimerRef.current = null;
          resume();
        }, 4000);
      }
    }
    if (isSupabasePreview && !MIGRATION_GOAL_HORN_URL) {
      // Temporary self-contained browser-generated horn. No Base44 request.
      // Replace with a licensed, locally hosted MP3 using the env variable.
      try {
        generatedHornRef.current?.stop(0);
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('Browser audio generator unavailable');
        const context = new AudioCtx();
        const now = context.currentTime;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.12);
        gain.gain.setValueAtTime(0.16, now + 2.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.65);
        gain.connect(context.destination);
        const oscillators = [196, 247, 294].map(frequency => {
          const oscillator = context.createOscillator();
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(frequency, now);
          oscillator.connect(gain);
          oscillator.start(now);
          oscillator.stop(now + 2.7);
          return oscillator;
        });
        let stopped = false;
        const horn = {
          stop: (fadeSeconds = 0.2) => {
            if (stopped) return;
            stopped = true;
            const t = context.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, fadeSeconds));
            window.setTimeout(() => context.close().catch(() => {}), Math.ceil(Math.max(0.03, fadeSeconds) * 1000) + 70);
            if (generatedHornRef.current === horn) generatedHornRef.current = null;
            setGoalPlaying(false);
          },
        };
        generatedHornRef.current = horn;
        oscillators[0].addEventListener('ended', () => horn.stop(0.03), { once: true });
        setGoalPlaying(true);
      } catch (error) {
        console.error('Local goal horn could not start:', error);
        setGoalPlaying(false);
      }
      return;
    }
    let ga = goalAudioRef.current;
    if (!ga) {
      ga = typeof Audio !== 'undefined' ? new Audio(isSupabasePreview ? MIGRATION_GOAL_HORN_URL : ORIGINAL_GOAL_HORN_URL) : null;
      if (ga) { ga.volume = 1; goalAudioRef.current = ga; }
    }
    if (ga) {
      if (!ga._wired) {
        ga.addEventListener('timeupdate', () => {
          if (!isSupabasePreview || !MIGRATION_GOAL_HORN_URL) return;
          const remaining = ga.duration - ga.currentTime;
          if (!Number.isFinite(remaining) || remaining < 0) return;
          ga.volume = Math.min(1, Math.max(0, remaining / GOAL_HORN_FADE_SECONDS));
          if (remaining <= GOAL_SONG_EARLY_SECONDS) {
            // Clear the callback first: timeupdate and ended may both fire.
            const resume = goalResumeRef.current;
            goalResumeRef.current = null;
            resume?.();
          }
        });
        ga.addEventListener('ended', () => {
          setGoalPlaying(false);
          ga.volume = 1;
          // Fallback if timeupdate skipped the final crossfade window.
          const resume = goalResumeRef.current;
          goalResumeRef.current = null;
          resume?.();
        });
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
    goalResumeRef.current = null;
    if (isSupabasePreview && generatedHornRef.current) {
      generatedHornRef.current.stop(sec);
      if (goalTimerRef.current) { clearTimeout(goalTimerRef.current); goalTimerRef.current = null; }
      return;
    }
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
      const resolveFresh = async (ids) => {
        try {
          const all = await queryClient.fetchQuery({ ...songsQueryOptions, staleTime: 0 });
          const byId = new Map(all.map((s) => [s.id, s]));
          return ids.map((id) => byId.get(id)).filter(Boolean);
        } catch { return []; }
      };
      const normKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (normKey === 'g') {
        e.preventDefault();
        dropFocus();
        const gsid = goalSetlistIdRef.current;
        const ids = gsid ? playlistSongsRef.current[gsid] : null;
        if (ids && ids.length) {
          (async () => {
            const songs = await resolveFresh(ids);
            if (!songs.length) return;
            triggerGoal(songs, 0, gsid);
          })();
        } else {
          triggerGoal();
        }
        return;
      }
      const entry = hotkeysRef.current[normKey];
      if (entry) {
        e.preventDefault();
        dropFocus();
        (async () => {
          const songs = await resolveFresh(entry.songIds);
          if (!songs.length) return;
          playSetlistRef.current(entry.playlistId, songs);
        })();
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
  }, [isPlaying, currentSong, goalPlaying, play, pause, next, prev, stopGoal, queryClient]);

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
    activeSetlistIdRef.current = null;
    queueRef.current = [song];
    setQueue([song]);
    setCurrentIndex(-1);
    playIndex(0);
  }, [playIndex]);
  const playQueueFrom = useCallback((songs, idx = 0) => {
    activeSetlistIdRef.current = null;
    queueRef.current = songs;
    setQueue(songs);
    setCurrentIndex(-1);
    playIndex(idx);
  }, [playIndex]);
  playQueueFromRef.current = playQueueFrom;
  // play a setlist with a no-repeat shuffle bag: a song can't replay until every
  // other song in the setlist has been used, then the cycle resets.
  const playSetlist = useCallback((setlistId, songs) => {
    if (!songs || !songs.length) return;
    let played = setlistPlayedRef.current[setlistId];
    if (!played) { played = new Set(); setlistPlayedRef.current[setlistId] = played; }
    let available = songs.filter((s) => !played.has(s.id));
    if (!available.length) { played.clear(); available = songs; }
    // Fisher-Yates: genuinely random order, no bias from old play_count values.
    const arr = [...available];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // don't start a fresh cycle with the song that ended the previous one
    const lastId = setlistLastRef.current[setlistId];
    if (lastId && arr.length > 1 && arr[0].id === lastId) {
      const swapWith = 1 + Math.floor(Math.random() * (arr.length - 1));
      [arr[0], arr[swapWith]] = [arr[swapWith], arr[0]];
    }
    activeSetlistIdRef.current = setlistId;
    queueRef.current = arr;
    setQueue(arr);
    setCurrentIndex(-1);
    playIndex(0);
  }, [playIndex]);
  playSetlistRef.current = playSetlist;

  const value = {
    queue, currentIndex, currentSong, isPlaying, currentTime, duration, playbackError,
    masterVolume, isFading, audio, goalPlaying, goalSetlistId, setGoalSetlist, refreshHotkeys,
    play, pause, next, prev, seek, setMasterVolume, fadeOut, triggerGoal, stopGoal,
    addToQueue, addManyToQueue, removeFromQueue, reorderQueue, clearQueue, playNow, playQueueFrom, playSetlist,
  };
  return <DjContext.Provider value={value}>{children}</DjContext.Provider>;
}