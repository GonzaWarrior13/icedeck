import React, { useId, useState } from 'react';
import { PERSONAL_SPOTIFY_PATH, spotifyConnected } from '@/lib/spotifyStandalone';
import { addPersonalSpotifyTrack, readPersonalSpotifyTracks, removePersonalSpotifyTrack } from '@/lib/spotifyPersonalLibrary';

export default function SpotifyPersonalLibrary() {
  const [tracks, setTracks] = useState(readPersonalSpotifyTracks);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const connected = spotifyConnected(true);

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
    <section aria-label="Personal Spotify library" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Spotify tracks</h2>
      <p className="text-sm text-muted-foreground">Saved in this browser for personal playback.</p>
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
      ) : <a href={PERSONAL_SPOTIFY_PATH} className="text-sm underline">Connect Spotify to add tracks</a>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {tracks.length > 0 && (
        <ul className="divide-y divide-border">
          {tracks.map(track => (
            <li key={track.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{track.title}</p>
                <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
              </div>
              <a className="text-sm underline" href={PERSONAL_SPOTIFY_PATH + '?track=' + track.id}
                aria-label={'Load ' + track.title + ' in the personal player'}>Load</a>
              <a className="text-sm underline" href={'https://open.spotify.com/track/' + track.id}
                target="_blank" rel="noreferrer">Spotify</a>
              <button type="button" className="text-sm underline" aria-label={'Remove ' + track.title}
                onClick={() => removeTrack(track.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
