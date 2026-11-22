import React, { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  isSpotifyConnected,
  disconnectSpotify,
  startSpotifyAuth,
  fetchSpotifyPlaylists,
  fetchSpotifyPlaylistTracks,
  spotifyRedirectUri,
  hasSpotifyStreaming,
} from '@/lib/spotify';

const MAX_PER_IMPORT = 200;

// Spotify import: sign in, pick a playlist, pull its tracks into the library.
export default function SpotifyPanel({ existingSongs = [], onImported }) {
  const [connected, setConnected] = useState(() => isSpotifyConnected());
  const [streaming, setStreaming] = useState(() => hasSpotifyStreaming());
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(spotifyRedirectUri());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy the redirect URI manually from the text above.');
    }
  };

  const loadPlaylists = async () => {
    setLoading(true);
    setError('');
    try {
      setPlaylists(await fetchSpotifyPlaylists());
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not load your playlists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected) loadPlaylists();
  }, [connected]);

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      await startSpotifyAuth();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not start the Spotify login');
      setConnecting(false);
    }
  };

  const handleImport = async (playlist) => {
    setImportingId(playlist.id);
    setError('');
    setMessage('');
    try {
      const tracks = await fetchSpotifyPlaylistTracks(playlist.id);
      const known = new Set(existingSongs.map((s) => s.spotify_id).filter(Boolean));
      const seen = new Set();
      const rows = [];
      tracks.forEach((t) => {
        if (!t || !t.id || t.type === 'episode') return;
        if (known.has(t.id) || seen.has(t.id)) return;
        seen.add(t.id);
        rows.push({
          title: (t.name || 'Spotify track').slice(0, 200),
          artist: ((t.artists || []).map((a) => a.name).join(', ') || 'Spotify').slice(0, 200),
          duration: Math.round((t.duration_ms || 0) / 1000),
          source: 'spotify',
          spotify_id: t.id,
          spotify_uri: t.uri,
          preview_url: t.preview_url || '',
          start_point: 0,
          volume: 100,
          tags: [],
        });
      });
      if (!rows.length) {
        setMessage('Every track in that playlist is already in your library.');
        return;
      }
      const created = await base44.entities.Song.bulkCreate(rows.slice(0, MAX_PER_IMPORT));
      const added = Array.isArray(created) ? created : [];
      onImported(added);
      setMessage(`Added ${added.length} track${added.length === 1 ? '' : 's'} from ${playlist.name}.`);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  const handleDisconnect = () => {
    disconnectSpotify();
    setConnected(false);
    setStreaming(false);
    setPlaylists([]);
    setMessage('');
    setError('');
  };

  return (
    <div className="space-y-2">
      {!connected ? (
        <div className="space-y-2">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full inline-flex items-center justify-center gap-2 min-h-10 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 px-3 text-sm font-semibold"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
            {connecting ? 'Opening Spotify…' : 'Connect Spotify'}
          </button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            In your Spotify app’s settings, add this exact Redirect URI, then connect:
            <span className="block mt-1 break-all rounded bg-secondary/60 px-2 py-1 text-foreground/80">
              {spotifyRedirectUri()}
            </span>
          </p>
          <button
            onClick={copyRedirect}
            className="w-full min-h-10 rounded-[10px] border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            {copied ? 'Copied' : 'Copy redirect URI'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-primary">
              <Check className="w-3 h-3" aria-hidden="true" /> Connected
            </span>
            <button onClick={handleDisconnect} className="underline hover:text-foreground">Disconnect</button>
          </div>

          {!streaming && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full min-h-9 rounded-[8px] border border-primary/50 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50 transition-colors"
            >
              {connecting ? 'Opening Spotify…' : 'Reconnect for full-song playback'}
            </button>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading playlists…
            </div>
          ) : playlists.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No playlists found on this account.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto scroll-area divide-y divide-border rounded-lg border border-border">
              {playlists.map((pl) => (
                <li key={pl.id} className="flex items-center gap-2 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pl.name}</p>
                    <p className="text-[11px] text-muted-foreground">{pl.tracks?.total ?? 0} tracks</p>
                  </div>
                  <button
                    onClick={() => handleImport(pl)}
                    disabled={!!importingId}
                    className="shrink-0 min-h-9 px-3 rounded-[8px] border border-border hover:bg-secondary disabled:opacity-50 text-xs font-medium transition-colors"
                  >
                    {importingId === pl.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Import'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            With Spotify Premium, imported tracks play in full through the console. Without Premium
            only 30-second previews play, and the waveform and start-point tools stay on uploaded files.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-primary">{message}</p>}
    </div>
  );
}