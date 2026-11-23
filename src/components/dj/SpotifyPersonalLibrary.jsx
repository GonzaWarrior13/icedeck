import React, { useEffect, useId, useRef, useState } from 'react';
import { spotifyConnected } from '@/lib/spotifyStandalone';
import { addPersonalSpotifyTrack, readPersonalSpotifyTracks, removePersonalSpotifyTrack } from '@/lib/spotifyPersonalLibrary';

import { mountPersonalSpotify } from '@/lib/spotifyPersonalPlayer';

export default function SpotifyPersonalLibrary({ dj }) {
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
      beforePlay() {
        if (currentDj.current.goalPlaying) throw new Error('Wait for the goal horn to finish.');
        currentDj.current.audio?.pause();
      },
    });
    return () => controller.current.dispose();
  }, []);

  useEffect(() => {
    if (dj.isPlaying || dj.goalPlaying) controller.current?.pause();
  }, [dj.isPlaying, dj.goalPlaying]);

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

  return (
    <section ref={root} aria-label="Personal Spotify library" className="space-y-3 rounded-xl border border-border bg-card p-4">
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
      {tracks.length > 0 && (
        <ul className="divide-y divide-border">
          {tracks.map(track => (
            <li key={track.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{track.title}</p>
                <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
              </div>
              <button type="button" className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
                disabled={!ready || dj.goalPlaying} aria-label={'Play ' + track.title}
                onClick={() => controller.current.playTrack(track.id)}>Play</button>
              <a className="text-sm underline" href={'https://open.spotify.com/track/' + track.id}
                target="_blank" rel="noreferrer">Spotify</a>
              <button type="button" className="text-sm underline" aria-label={'Remove ' + track.title}
                onClick={() => removeTrack(track.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div id="controls" className="space-y-3 border-t border-border pt-3" hidden>
        <figure className="flex items-center gap-3" hidden>
          <img alt="" className="h-12 w-12 rounded-md" hidden />
          <figcaption className="text-sm font-medium" />
        </figure>
        <div className="flex items-center gap-3">
          <button id="toggle" type="button" className="text-sm underline disabled:opacity-50" disabled>Pause</button>
          <span id="progress" className="text-sm text-muted-foreground" />
          <button id="disconnect" type="button" className="ml-auto text-sm underline">Disconnect Spotify</button>
        </div>
      </div>
    </section>
  );
}
