import React, { useEffect, useState } from 'react';
import { Music, X, Loader2 } from 'lucide-react';
import { saveSpotifyPlaylistTracks } from '@/lib/spotifyPersonalLibrary';
import SongUploader from '@/components/dj/SongUploader';
import {
  spotifyConfigured, spotifyConnected, spotifyCallbackUrl,
  disconnectSpotifyStandalone, startSpotifyStandaloneAuth,
  getSpotifyPlaylistsStandalone, getSpotifyPlaylistItemsStandalone,
} from '@/lib/spotifyStandalone';

export default function SpotifySetupNotice({ onUploaded, allowStreamingImport }) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(spotifyConnected);
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(null);
  const [uploaded, setUploaded] = useState('');
  const [chosenIds, setChosenIds] = useState([]);
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
    setTracks([]); setSelectedTrackIndex(null); setUploaded(''); setChosenIds([]);
    try { setTracks(await getSpotifyPlaylistItemsStandalone(playlist.id)); }
    catch(e) { setError(e.message); }
    finally { setBusy(false); }
  };
  function addSelection() {
    try {
      saveSpotifyPlaylistTracks(tracks.filter(track => chosenIds.includes(track.id)));
      setUploaded('Selected songs are in the Library.');
      setChosenIds([]);
      setError('');
    } catch (cause) {
      setError(cause.message);
    }
  }
  const selectedTrack = selectedTrackIndex === null ? null : tracks[selectedTrackIndex];
  return <div className="relative">
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
      className="inline-flex items-center gap-1.5 min-h-9 rounded-[10px] border border-border px-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:min-h-10 md:px-3.5 md:text-sm">
      <Music className="w-4 h-4" aria-hidden="true" /> Spotify playlists
    </button>
    {open && <div className="absolute right-0 mt-2 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-[10px] border border-border bg-popover p-4 space-y-3 shadow-lg">
      <div className="flex justify-between gap-2 items-center">
        <h2 className="font-semibold">Spotify playlists</h2>
        <button type="button" aria-label="Close Spotify" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
      </div>
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
          disconnectSpotifyStandalone(); setConnected(false); setPlaylists([]); setSelected(null); setTracks([]); setSelectedTrackIndex(null); setUploaded('');
        }}>Disconnect Spotify</button>
        {busy && <p className="flex items-center gap-2 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
        {!selected ? <div className="max-h-64 overflow-y-auto space-y-1">
          {playlists.map(pl => <button key={pl.id} type="button" className="block w-full text-left rounded border border-border p-2 hover:bg-secondary text-sm" onClick={() => inspect(pl)}>
            {pl.name} <span className="text-xs text-muted-foreground">({pl.items?.total ?? pl.tracks?.total ?? 0} tracks)</span>
          </button>)}
          {!busy && playlists.length === 0 && <p className="text-sm text-muted-foreground">No accessible playlists found.</p>}
        </div> : <>
          <button type="button" onClick={() => { setSelected(null); setTracks([]); setSelectedTrackIndex(null); setUploaded(''); }} className="text-xs underline">Back to playlists</button>
          <p className="font-medium text-sm">{selected.name}</p>
          <ul className="max-h-56 overflow-y-auto space-y-1">
            {tracks.map((track, index) => (
              <li key={`${track.id || 'track'}-${index}`} className="border-b border-border">
                {allowStreamingImport ? (
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm">
                    <input type="checkbox" disabled={!track.id || track.is_local || track.type === 'episode'}
                      checked={chosenIds.includes(track.id)}
                      onChange={event => setChosenIds(ids => event.target.checked ? [...ids, track.id] : ids.filter(id => id !== track.id))} />
                    <span>{track.name || 'Unknown track'}
                      <span className="block text-xs text-muted-foreground">{(track.artists || []).map(artist => artist.name).join(', ')}</span>
                    </span>
                  </label>
                ) : <button type="button" aria-pressed={selectedTrackIndex === index}
                  className="w-full rounded px-2 py-2 text-left text-sm hover:bg-secondary aria-pressed:bg-secondary"
                  onClick={() => { setSelectedTrackIndex(index); setUploaded(''); }}>
                  {track.name || 'Unknown track'}
                  <span className="block text-xs text-muted-foreground">{(track.artists || []).map(artist => artist.name).join(', ')}</span>
                </button>}
              </li>
            ))}
          </ul>
          {!busy && !tracks.length && !error && <p className="text-sm text-muted-foreground">This playlist has no accessible tracks.</p>}
          {allowStreamingImport && <button type="button" disabled={!chosenIds.length || busy}
            onClick={addSelection} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
            Add selected to Library
          </button>}
          {!allowStreamingImport && selectedTrack && <div className="space-y-2">
            <p className="text-sm">Upload an audio file for <strong>{selectedTrack.name}</strong>.</p>
            <SongUploader key={selectedTrackIndex} useSupabase
              trackMetadata={{
                title: selectedTrack.name,
                artist: (selectedTrack.artists || []).map(artist => artist.name).join(', '),
              }}
              onUploaded={song => { onUploaded(song); setUploaded(song.title); }}
            />
          </div>}
          {uploaded && <p role="status" className="text-sm">{allowStreamingImport ? uploaded : `Added ${uploaded} to the Library.`}</p>}
        </>}
      </>}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {allowStreamingImport ? 'Select tracks to stream through Spotify in your personal Library.' : 'Pick a song, then attach its audio file. IceDeck fills in the title and artist.'}
      </p>
    </div>}
  </div>;
}
