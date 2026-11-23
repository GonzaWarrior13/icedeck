import React, { useEffect, useId, useRef, useState } from 'react';
import SongCard from '@/components/dj/SongCard';
import { createPortal } from 'react-dom';
import { spotifyConnected } from '@/lib/spotifyStandalone';
import { addPersonalSpotifyTrack, readPersonalSpotifyTracks, removePersonalSpotifyTrack } from '@/lib/spotifyPersonalLibrary';

import { mountPersonalSpotify } from '@/lib/spotifyPersonalPlayer';

export default function SpotifyPersonalLibrary({ dj, open, onOpen, filter, showTracks, rowsTarget, onCounts, playback, onPlayback }) {
  const [tracks, setTracks] = useState(readPersonalSpotifyTracks);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const connected = spotifyConnected(true);
  const root = useRef(null);
  const controller = useRef(null);
  const currentDj = useRef(dj);
  currentDj.current = dj;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    controller.current = mountPersonalSpotify(root.current, {
      setReady,
      onPlayback,
      beforePlay() {
        if (currentDj.current.goalPlaying) throw new Error('Wait for the goal horn to finish.');
        currentDj.current.audio?.pause();
      },
    });
    return () => controller.current.dispose();
  }, [onPlayback]);

  useEffect(() => {
    if (dj.isPlaying || dj.goalPlaying) controller.current?.interrupt();
  }, [dj.isPlaying, dj.goalPlaying]);

  useEffect(() => {
    if (!playback) return;
    function onSpace(event) {
      if (event.code !== 'Space' || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
        event.target?.closest?.('input, textarea, button, select, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (playback.isPlaying) playback.pause();
      else playback.play();
    }
    window.addEventListener('keydown', onSpace, true);
    return () => window.removeEventListener('keydown', onSpace, true);
  }, [playback]);

  async function addTrack(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setTracks(await addPersonalSpotifyTrack(input));
      setInput('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function removeTrack(id) {
    setError('');
    try {
      setTracks(removePersonalSpotifyTrack(id));
    } catch (cause) {
      setError(cause.message);
    }
  }

  const visibleTracks = showTracks ? tracks.filter(track =>
    (track.title + ' ' + track.artist).toLowerCase().includes(filter.toLowerCase())) : [];

  useEffect(() => {
    onCounts({ total: tracks.length, visible: visibleTracks.length });
  }, [onCounts, tracks.length, visibleTracks.length]);

  return (
    <>
    <section hidden={!open} ref={root} aria-label="Personal Spotify library" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Spotify tracks</h2>
      <p id="status" role="status" className="text-sm text-muted-foreground">Checking Spotify connection?</p>
      <p id="error" role="alert" className="text-sm text-destructive" hidden />
      <button id="connect" type="button" className="rounded-md border border-border px-3 py-2" hidden>Connect Spotify</button>
      {connected ? (
        <form onSubmit={addTrack}>
          <label htmlFor={inputId} className="mb-1 block text-sm">Spotify track link to save</label>
          <div className="flex flex-wrap gap-2">
            <input id={inputId} value={input} onChange={event => setInput(event.target.value)}
              required placeholder="https://open.spotify.com/track/…"
              className="min-w-0 flex-1 rounded-md border border-border bg-background p-2" />
            <button type="submit" disabled={busy} className="rounded-md border border-border px-3 py-2 disabled:opacity-50">
              {busy ? 'Adding…' : 'Add to Library'}
            </button>
          </div>
        </form>
      ) : null}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div id="controls" className="space-y-3 border-t border-border pt-3" hidden>
        <button id="disconnect" type="button" className="text-sm underline">Disconnect Spotify</button>
      </div>
    </section>
    {rowsTarget && createPortal(visibleTracks.map(track => (
      <SongCard key={track.id}
        song={{...track, spotifyUrl: 'https://open.spotify.com/track/' + track.id}}
        isActive={playback?.currentSong.id === track.id}
        canPlay={!dj.goalPlaying && (!connected || ready)}
        onPlay={() => {
          if (ready) controller.current.playTrack(track.id);
          else onOpen();
        }}
        onDelete={() => {
          onOpen();
          removeTrack(track.id);
        }} />
    )), rowsTarget)}
    </>
  );
}
