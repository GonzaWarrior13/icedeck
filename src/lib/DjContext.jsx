import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { SpotifyEngine } from '@/lib/spotifyPlayer';
import { startAuth, waitForAuthCode, exchangeCode, restoreSession, refreshWith, disconnectSession } from '@/lib/spotifyAuth';

const GOAL_HORN_URL = 'https://media.base44.com/files/public/6a8f48cd9a055819d8b79b87/01968e6a6_toronto-maple-leafs-2019-goal-horn-1.mp3';

const defaultDj = {
  queue: [], currentIndex: -1, currentSong: null, isPlaying: false,
  currentTime: 0, duration: 0, masterVolume: 1, isFading: false, audio: null,
  spotifyConnected: false, spotifyPremium: false, spotifyDisplayName: '', playingPreview: false,
  play() {}, pause() {}, next() {}, prev() {}, seek() {}, setMasterVolume() {},
  fadeOut() {}, triggerGoal() {}, stopGoal() {}, goalPlaying: false,
  addToQueue() {}, addManyToQueue() {}, removeFromQueue() {}, reorderQueue() {},
  clearQueue() {}, playNow() {}, playQueueFrom() {},
  connectSpotify() {}, disconnectSpotify() {}, applySpotifySession() {},
};
const DjContext = createContext(defaultDj);
export const useDj = () => useContext(DjContext);

export function DjProvider({ children }) {
  const audioRef = useRef(null);
  if (typeof Audio !== 'undefined' && !audioRef.current) {
    audioRef.current = new Audio();
  }
  const audio = audioRef.current;
  const goalAudioRef = useRef(null);
  const spotifyEngineRef = useRef(null);
  const tokenRef = useRef(null);
  const activeEngineRef = useRef('html'); // 'html' | 'spotify'

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [isFading, setIsFading] = useState(false);
  const [goalPlaying, setGoalPlaying] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyPremium, setSpotifyPremium] = useState(false);
  const [spotifyDisplayName, setSpotifyDisplayName] = useState('');
  const [spotifyReady, setSpotifyReady] = useState(false);

  const queueRef = useRef([]);
  const indexRef = useRef(-1);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);

  const currentSong = currentIndex >= 0 ? queue[currentIndex] : null;

  const shouldUseSpotify = useCallback((song) => {
    return !!(song && song.source === 'spotify' && song.spotify_id && spotifyConnected && spotifyPremium);
  }, [spotifyConnected, spotifyPremium]);

  const getToken = useCallback(() => tokenRef.current?.access || '', []);

  // ---- token management ----
  const applySpotifySession = useCallback((data) => {
    tokenRef.current = {
      access: data.access_token,
      refresh: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
      remembered: !!data.remembered,
    };
    setSpotifyConnected(true);
    setSpotifyDisplayName(data.spotify_display_name || 'Spotify user');
    setSpotifyPremium(!!data.is_premium);
    if (!spotifyEngineRef.current) {
      const eng = new SpotifyEngine();
      eng.onStateChange = (state) => {
        if (activeEngineRef.current !== 'spotify') return;
        setIsPlaying(!state.paused);
        setDuration((state.duration || 0) / 1000);
        setCurrentTime((state.position || 0) / 1000);
      };
      eng.onEnd = () => nextRef.current();
      spotifyEngineRef.current = eng;
      eng.init(getToken).then(() => setSpotifyReady(true)).catch((e) => console.warn('Spotify init failed', e));
    }
  }, [getToken]);

  const ensureFreshToken = useCallback(async () => {
    const t = tokenRef.current;
    if (!t || !t.access) return null;
    if (Date.now() < t.expiresAt) return t.access;
    try {
      const data = t.refresh ? await refreshWith(t.refresh) : (t.remembered ? await restoreSession() : null);
      if (!data || !data.access_token) return null;
      applySpotifySession(data);
      return data.access_token;
    } catch (e) {
      return null;
    }
  }, [applySpotifySession]);

  const connectSpotify = useCallback(async (remember) => {
    const popup = await startAuth(remember);
    if (!popup) return; // popup blocked — user should allow popups for this site
    const code = await waitForAuthCode();
    try { popup.close(); } catch (_) {}
    const data = await exchangeCode(code);
    applySpotifySession(data);
  }, [applySpotifySession]);

  const disconnectSpotify = useCallback(async () => {
    try { await disconnectSession(); } catch (_) {}
    if (spotifyEngineRef.current) {
      await spotifyEngineRef.current.disconnect();
      spotifyEngineRef.current = null;
    }
    tokenRef.current = null;
    activeEngineRef.current = 'html';
    setSpotifyConnected(false);
    setSpotifyPremium(false);
    setSpotifyDisplayName('');
    setSpotifyReady(false);
  }, []);

  // restore a remembered session on load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await restoreSession();
        if (!cancelled && data && data.access_token) applySpotifySession(data);
      } catch (_) { /* not connected — fine */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- volume ----
  const applyVolume = useCallback(() => {
    const sv = currentSong && currentSong.volume != null ? currentSong.volume / 100 : 1;
    const vol = Math.min(1, Math.max(0, sv * masterVolume));
    if (audio) audio.volume = vol;
    if (activeEngineRef.current === 'spotify' && spotifyEngineRef.current) {
      spotifyEngineRef.current.setVolume(vol);
    }
  }, [audio, currentSong, masterVolume]);

  useEffect(() => { applyVolume(); }, [applyVolume]);

  // ---- playback ----
  const playIndex = useCallback(async (index) => {
    const q = queueRef.current;
    if (index < 0 || index >= q.length) return;
    const song = q[index];
    setCurrentIndex(index);
    setCurrentTime(0);

    if (shouldUseSpotify(song)) {
      activeEngineRef.current = 'spotify';
      if (audio) { audio.pause(); audio.currentTime = 0; }
      await ensureFreshToken();
      if (!spotifyEngineRef.current) return;
      try {
        await spotifyEngineRef.current.playUri(`spotify:track:${song.spotify_id}`, (song.start_point || 0) * 1000);
        spotifyEngineRef.current.setVolume(Math.min(1, Math.max(0, ((song.volume != null ? song.volume / 100 : 1) * masterVolume))));
      } catch (e) {
        console.warn('Spotify playback failed, falling back to preview', e);
        activeEngineRef.current = 'html';
        const url = song.preview_url || song.file_url;
        if (audio && url) { audio.src = url; audio.play().catch(() => {}); }
      }
    } else {
      activeEngineRef.current = 'html';
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
    }
  }, [audio, ensureFreshToken, masterVolume, shouldUseSpotify]);

  const nextRef = useRef(() => {});
  nextRef.current = () => {
    const q = queueRef.current;
    const ni = indexRef.current + 1;
    if (ni < q.length) playIndex(ni);
    else {
      if (audio) audio.pause();
      if (spotifyEngineRef.current) spotifyEngineRef.current.pause();
      setIsPlaying(false);
    }
  };

  const play = useCallback(() => {
    if (activeEngineRef.current === 'spotify' && spotifyEngineRef.current) spotifyEngineRef.current.resume();
    else audio?.play().catch(() => {});
  }, [audio]);

  const pause = useCallback(() => {
    if (activeEngineRef.current === 'spotify' && spotifyEngineRef.current) spotifyEngineRef.current.pause();
    else audio?.pause();
  }, [audio]);

  const next = useCallback(() => nextRef.current(), []);
  const prev = useCallback(() => {
    const pi = indexRef.current - 1;
    if (pi >= 0) playIndex(pi);
  }, [playIndex]);

  const seek = useCallback((t) => {
    if (activeEngineRef.current === 'spotify' && spotifyEngineRef.current) spotifyEngineRef.current.seek(t * 1000);
    else if (audio) audio.currentTime = t;
    setCurrentTime(t);
  }, [audio]);

  const setMasterVolume = useCallback((v) => setMasterVolumeState(v), []);

  const fadeOut = useCallback((sec = 2, thenNext = true) => {
    if (isFading) return;
    const eng = activeEngineRef.current === 'spotify' ? spotifyEngineRef.current : null;
    if (!eng && !audio) return;
    setIsFading(true);
    const sv = currentSong && currentSong.volume != null ? currentSong.volume / 100 : 1;
    const startVol = Math.min(1, Math.max(0, sv * masterVolume)) || 1;
    const t0 = performance.now();
    const step = () => {
      const frac = Math.min(1, (performance.now() - t0) / (sec * 1000));
      const v = startVol * (1 - frac);
      if (eng) eng.setVolume(v);
      else if (audio) audio.volume = v;
      if (frac < 1) requestAnimationFrame(step);
      else {
        if (eng) eng.pause();
        else if (audio) audio.pause();
        if (eng) eng.setVolume(startVol);
        else if (audio) audio.volume = startVol;
        setIsFading(false);
        if (thenNext) next();
      }
    };
    requestAnimationFrame(step);
  }, [audio, currentSong, isFading, masterVolume, next]);

  // goal horn (local clip)
  const triggerGoal = useCallback(() => {
    audio?.pause();
    if (spotifyEngineRef.current) spotifyEngineRef.current.pause();
    setIsPlaying(false);
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
      else { ga.pause(); try { ga.currentTime = 0; } catch (_) {} ga.volume = startVol; setGoalPlaying(false); }
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
      if (e.code === 'Space' || e.key === ' ') {
        if (goalPlaying) { e.preventDefault(); stopGoal(); return; }
        e.preventDefault();
        if (isPlaying) pause();
        else if (currentSong) play();
      } else if (e.key === 'ArrowRight') {
        next();
      } else if (e.key === 'ArrowLeft') {
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
      if (activeEngineRef.current !== 'html') return;
      setCurrentTime(audio.currentTime);
      const song = queueRef.current[indexRef.current];
      if (song && song.end_point && audio.currentTime >= song.end_point) next();
    };
    const onDur = () => { if (activeEngineRef.current === 'html') setDuration(audio.duration || 0); };
    const onPlay = () => { if (activeEngineRef.current === 'html') setIsPlaying(true); };
    const onPause = () => { if (activeEngineRef.current === 'html') setIsPlaying(false); };
    const onEnded = () => { if (activeEngineRef.current === 'html') next(); };
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
    if (spotifyEngineRef.current) spotifyEngineRef.current.pause();
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

  const playingPreview = !!(currentSong && currentSong.source === 'spotify' && currentSong.spotify_id && !(spotifyConnected && spotifyPremium));

  const value = {
    queue, currentIndex, currentSong, isPlaying, currentTime, duration,
    masterVolume, isFading, audio, goalPlaying,
    spotifyConnected, spotifyPremium, spotifyDisplayName, spotifyReady, playingPreview,
    play, pause, next, prev, seek, setMasterVolume, fadeOut, triggerGoal, stopGoal,
    addToQueue, addManyToQueue, removeFromQueue, reorderQueue, clearQueue, playNow, playQueueFrom,
    connectSpotify, disconnectSpotify, applySpotifySession,
  };
  return <DjContext.Provider value={value}>{children}</DjContext.Provider>;
}