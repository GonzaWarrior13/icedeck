import React, { useState } from 'react';
import { signIn, getTeamSongs, getTeamPlaylists, createPrivateAudioUrl, isSupabaseConfigured } from '@/api/supabaseClient';

// Isolated integration test: does not use Base44 auth, alter production data,
// or expose a private bucket. Signed URLs are short-lived and kept in memory.
export default function SupabaseConnectionTest() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [token, setToken] = useState('');
  const [songs, setSongs] = useState([]);
  async function connect(event) {
    event.preventDefault();
    setBusy(true); setError(''); setResults(null); setAudioUrl('');
    try {
      const session = await signIn(email, password);
      setPassword('');
      const [tracks, playlists] = await Promise.all([
        getTeamSongs(session.access_token),
        getTeamPlaylists(session.access_token),
      ]);
      setToken(session.access_token);
      setSongs(tracks);
      setResults({ tracks: tracks.length, playlists: playlists.length,
        entries: playlists.reduce((sum, p) => sum + p.song_ids.length, 0) });
    } catch (err) { setError(err.message || 'Connection failed'); }
    finally { setBusy(false); }
  }
  async function playTest() {
    setBusy(true); setError(''); setAudioUrl('');
    try {
      const first = songs.find(song => song.storage_path);
      if (!first) throw new Error('No song has a storage path');
      setAudioUrl(await createPrivateAudioUrl(first.storage_path, token, 600));
    } catch (err) { setError(err.message || 'Audio access failed'); }
    finally { setBusy(false); }
  }
  return (
    <main style={{maxWidth:540,margin:'5vh auto',padding:24,fontFamily:'system-ui'}}>
      <h1>DropDeck · Supabase connection test</h1>
      <p>This checks your private team data without changing Base44.</p>
      {!isSupabaseConfigured ? (
        <p role="alert">Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.</p>
      ) : (
        <form onSubmit={connect} style={{display:'grid',gap:12}}>
          <label>Email <input type="email" required autoComplete="email" value={email}
            onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',color:'#111'}} /></label>
          <label>Password <input type="password" required autoComplete="current-password" value={password}
            onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',color:'#111'}} /></label>
          <button type="submit" disabled={busy} style={{padding:12,border:'1px solid currentColor'}}>
            {busy ? 'Checking…' : 'Sign in and check Supabase'}
          </button>
        </form>
      )}
      {error && <p role="alert" style={{color:'#dc2626'}}>{error}</p>}
      {results && <section aria-live="polite">
        <h2>Authenticated database results</h2>
        <p>Songs: {results.tracks} · Playlists: {results.playlists} · Playlist entries: {results.entries}</p>
        <button disabled={busy} onClick={playTest} style={{padding:12,border:'1px solid currentColor'}}>
          Test private MP3 playback
        </button>
        {audioUrl && <div style={{marginTop:16}}><audio controls src={audioUrl} /></div>}
      </section>}
      <p style={{fontSize:12,opacity:.7}}>Test-only screen. Audio URLs expire after 10 minutes. Do not use it for game day yet.</p>
    </main>
  );
}
