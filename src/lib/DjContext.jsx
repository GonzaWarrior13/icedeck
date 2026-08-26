import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';

const DjContext = createContext(null);
export const useDj = () => useContext(DjContext);

export function DjProvider({ children }) {
  const audioRef = useRef(null);
  if (typeof Audio !== 'undefined' && !audioRef.current) {
    audioRef.current = new Audio();
  }
  const audio = audioRef.current;

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [isFading, setIsFading] = useState(false);

  const queueRef = useRef([]);
  const indexRef = useRef(-1);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);

  const currentSong = currentIndex >= 0 ? queue[currentIndex] : null;

  const applyVolume = useCallback(() => {
    if (!audio) return;
    const sv = currentSong && currentSong.volume != null ? currentSong.volume / 100 : 1;
    audio.volume = Math.min(1, Math.max(0, sv * masterVolume));
  }, [audio, currentSong, masterVolume]);

  useEffect(() => { applyVolume(); }, [applyVolume]);

  const playIndex = useCallback((index) => {
    const q = queueRef.current;
    if (!audio || index < 0 || index >= q.length) return;
    const song = q[index];
    const url = song.preview_url || song.file_url;
    if (!url) return;
    setCurrentIndex(index);
    setCurrentTime(0);
    audio.src = url;
    const start = song.start_point || 0;
    audio.play().catch(() => {});
    if (start > 0) {
      const onMeta = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        if (start < (audio.duration || 0)) audio.currentTime = start;
      };
      audio.addEventListener('loadedmetadata', onMeta);
    }
  }, [audio]);

  const play = useCallback(() => { audio?.play().catch(() => {}); }, [audio]);
  const pause = useCallback(() => { audio?.pause(); }, [audio]);

  const next = useCallback(() => {
    const q = queueRef.current;
    const ni = indexRef.current + 1;
    if (ni < q.length) playIndex(ni);
    else { audio?.pause(); setIsPlaying(false); }
  }, [audio, playIndex]);

  const prev = useCallback(() => {
    const pi = indexRef.current - 1;
    if (pi >= 0) playIndex(pi);
  }, [playIndex]);

  const seek = useCallback((t) => { if (audio) audio.currentTime = t; }, [audio]);

  const setMasterVolume = useCallback((v) => setMasterVolumeState(v), []);

  const fadeOut = useCallback((sec = 2, thenNext = true) => {
    if (!audio || isFading) return;
    setIsFading(true);
    const startVol = audio.volume || 1;
    const t0 = performance.now();
    const step = () => {
      const frac = Math.min(1, (performance.now() - t0) / (sec * 1000));
      audio.volume = startVol * (1 - frac);
      if (frac < 1) requestAnimationFrame(step);
      else {
        setIsFading(false);
        audio.pause();
        audio.volume = startVol;
        if (thenNext) next();
      }
    };
    requestAnimationFrame(step);
  }, [audio, isFading, next]);

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

  const value = {
    queue, currentIndex, currentSong, isPlaying, currentTime, duration,
    masterVolume, isFading, audio,
    play, pause, next, prev, seek, setMasterVolume, fadeOut,
    addToQueue, addManyToQueue, removeFromQueue, reorderQueue, clearQueue, playNow, playQueueFrom,
  };
  return <DjContext.Provider value={value}>{children}</DjContext.Provider>;
}