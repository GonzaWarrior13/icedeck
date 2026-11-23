import React, { useEffect, useState } from 'react';
import { Music, X, Loader2 } from 'lucide-react';
import {
  PERSONAL_SPOTIFY_PATH, personalSpotifyEnabled, spotifyConfigured, spotifyConnected, spotifyCallbackUrl,
  disconnectSpotifyStandalone, startSpotifyStandaloneAuth,
  getSpotifyPlaylistsStandalone, getSpotifyPlaylistItemsStandalone,
} from '@/lib/spotifyStandalone';

// Spotify API metadata is not MP3 audio. This screen deliberately does NOT
// copy unplayable Spotify tracks into a Supabase hockey music library.
export default function SpotifySetupNotice() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(spotifyConnected);
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || !connected) return;
    let cancelled = false;
    setBusy(true); setError('');
    getSpotifyPlaylistsStandalone().then(list => { if (!cancelled) setPlaylists(list); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, connected]);
  const inspect = async playlist => {
    setBusy(true); setError(''); setSelected(playlist);
    try { setTracks(await getSpotifyPlaylistItemsStandalone(playlist.id)); }
    catch(e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="relative">
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
      className="inline-flex items-center gap-1.5 min-h-9 rounded-[10px] border border-border px-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:min-h-10 md:px-3.5 md:text-sm">
      <Music className="w-4 h-4" aria-hidden="true" /> {connected ? 'Spotify connected' : 'Connect Spotify'}
    </button>
    {open && <div className="absolute right-0 mt-2 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-[10px] border border-border bg-popover p-4 space-y-3 shadow-lg">
      <div className="flex justify-between gap-2 items-center">
        <h2 className="font-semibold">Spotify playlists</h2>
        <button type="button" aria-label="Close Spotify" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
      </div>
      {personalSpotifyEnabled && (
        <a href={PERSONAL_SPOTIFY_PATH} className="block text-sm underline">Open personal Spotify player</a>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {!spotifyConfigured ? <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">Add your Spotify Client ID as VITE_SPOTIFY_CLIENT_ID before connecting. No client secret belongs in the browser.</p>
        <p className="text-xs break-all">Redirect URI to register: {spotifyCallbackUrl()}</p>
      </div> : !connected ? <div className="space-y-2">
        <button type="button" onClick={() => startSpotifyStandaloneAuth().catch(e => setError(e.message))}
          className="rounded bg-primary text-primary-foreground px-3 py-2 text-sm">Connect Spotify</button>
        <p className="text-xs text-muted-foreground">Redirect URI: {spotifyCallbackUrl()}</p>
      </div> : <>
        <button type="button" className="text-xs underline" onClick={() => {
          disconnectSpotifyStandalone(); setConnected(false); setPlaylists([]); setSelected(null); setTracks([]);
        }}>Disconnect Spotify</button>
        {busy && <p className="flex items-center gap-2 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
        {!selected ? <div className="max-h-64 overflow-y-auto space-y-1">
          {playlists.map(pl => <button key={pl.id} type="button" className="block w-full text-left rounded border border-border p-2 hover:bg-secondary text-sm" onClick={() => inspect(pl)}>
            {pl.name} <span className="text-xs text-muted-foreground">({pl.items?.total ?? pl.tracks?.total ?? 0} tracks)</span>
          </button>)}
          {!busy && playlists.length === 0 && <p className="text-sm text-muted-foreground">No accessible playlists found.</p>}
        </div> : <>
          <button type="button" onClick={() => { setSelected(null); setTracks([]); }} className="text-xs underline">Back to playlists</button>
          <p className="font-medium text-sm">{selected.name}</p>
          <ul className="max-h-56 overflow-y-auto space-y-1">
            {tracks.map((t,i) => <li key={t.id || i} className="text-xs border-b border-border py-1">{t.name || 'Unknown track'} — {(t.artists || []).map(a=>a.name).join(', ')}</li>)}
          </ul>
        </>}
      </>}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Spotify connection allows viewing your playlist information. It does not provide downloadable MP3 files or authorize playback inside IceDeck.
        Spotify developer access may require Premium and an approved test-user account.
      </p>
    </div>}
  </div>;
}
