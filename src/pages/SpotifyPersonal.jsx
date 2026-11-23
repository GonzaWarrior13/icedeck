import React, { useEffect, useRef } from 'react';
import { mountPersonalSpotify } from '@/lib/spotifyPersonalPlayer';

export default function SpotifyPersonal() {
  const root = useRef(null);
  useEffect(() => mountPersonalSpotify(root.current), []);

  const button = 'rounded-md border border-border px-3 py-2 disabled:opacity-50';

  return (
    <main ref={root} className="mx-auto mt-16 max-w-lg space-y-4 rounded-xl border border-border bg-card p-6">
      <a href="/" className="text-sm underline">Back to IceDeck</a>
      <h1 className="text-2xl font-semibold">Personal Spotify player</h1>
      <p id="status" role="status">Checking Spotify connection…</p>
      <p id="error" role="alert" className="text-destructive" hidden></p>
      <button id="connect" type="button" className={button} hidden>Connect Spotify</button>
      <section id="controls" aria-label="Spotify playback" hidden>
        <form className="space-y-3">
          <label htmlFor="track" className="block">Spotify track link</label>
          <input id="track" className="w-full rounded-md border border-border bg-background p-2" type="text"
            placeholder="https://open.spotify.com/track/…" required />
          <div className="flex flex-wrap gap-2">
            <button id="play" className={button} disabled>Play track</button>
            <button id="toggle" type="button" className={button} disabled>Pause</button>
            <button id="disconnect" type="button" className={button}>Disconnect</button>
          </div>
        </form>
        <figure className="mt-4" hidden>
          <img alt="" className="mb-2 h-16 w-16 rounded-md" hidden />
          <figcaption></figcaption>
        </figure>
        <p id="progress" className="mt-2 text-sm text-muted-foreground"></p>
      </section>
    </main>
  );
}
