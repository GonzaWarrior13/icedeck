import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { DjProvider, useDj } from '@/lib/DjContext';
import { signIn, getTeamSongs, getTeamPlaylists, createPrivateAudioUrl } from '@/api/supabaseClient';

// A separate, read-only DJ migration test. The live Base44 app is unchanged.
// Signed URLs are created only when a track is selected, never saved in localStorage.
function Preview() {
  const dj = useDj();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function connect(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const session = await signIn(email, password);
      setPassword('');
      const [s,p] = await Promise.all([
        getTeamSongs(session.access_token), getTeamPlaylists(session.access_token)
      ]);
      setToken(session.access_token); setSongs(s); setPlaylists(p);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function playSong(song) {
    setBusy(true); setError('');
    try {
      const url = await createPrivateAudioUrl(song.storage_path, token, 3600);
      dj.playNow({ ...song, preview_url: '', file_url: url });
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const byId = new Map(songs.map(s => [s.id,s]));
  return <main style={{maxWidth:850,margin:'24px auto',padding:20,fontFamily:'system-ui'}}>
    <h1>IceDeck · Supabase DJ preview</h1>
    <p>Read-only migration test. Base44 production remains unchanged.</p>
    {!token ? <form onSubmit={connect} style={{display:'grid',gap:10,maxWidth:440}}>
      <label>Email <input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",padding:10,color:"#111",background:"#fff",border:"1px solid #888",borderRadius:4}}/></label>
      <label>Password <input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:"block",width:"100%",padding:10,color:"#111",background:"#fff",border:"1px solid #888",borderRadius:4}}/></label>
      <button disabled={busy}>Sign in</button>
    </form> : <>
      <p>{songs.length} songs · {playlists.length} playlists</p>
      <section aria-label="DJ player">
        <h2>Player</h2>
        <p>{dj.currentSong?.title || 'Select a song'}</p>
        <button onClick={dj.play} disabled={!dj.currentSong}>Play</button>{' '}
        <button onClick={dj.pause} disabled={!dj.currentSong}>Fade / Pause</button>{' '}
        <button onClick={()=>dj.fadeOut(2,false)} disabled={!dj.currentSong}>Fade out</button>{' '}
        <button onClick={dj.next} disabled={!dj.currentSong}>Next</button>
        <p>Time: {Math.round(dj.currentTime)}s / {Math.round(dj.duration)}s</p>
        <label>Master volume <input type="range" min="0" max="1" step="0.05"
          value={dj.masterVolume} onChange={e=>dj.setMasterVolume(Number(e.target.value))}/></label>
      </section>
      <section><h2>Playlists</h2>
        {playlists.map(p=><details key={p.id}><summary>{p.name} ({p.song_ids.length})</summary>
          <ol>{p.song_ids.map((id,i)=>{const s=byId.get(id);return s?
            <li key={i}><button disabled={busy} onClick={()=>playSong(s)}>{s.title} — {s.artist}</button></li>:null;})}</ol>
        </details>)}
      </section>
      <section><h2>Library</h2><ol>{songs.map(s=><li key={s.id}>
        <button disabled={busy} onClick={()=>playSong(s)}>{s.title} — {s.artist}</button>
      </li>)}</ol></section>
    </>}
    {error && <p role="alert" style={{color:'#f87171'}}>{error}</p>}
    <p>Preview limitation: playlist songs are selectable individually; full playlist sequencing, editing and uploads are not migrated yet.</p>
  </main>;
}
export default function SupabaseDjPreview() {
  return <QueryClientProvider client={queryClientInstance}><DjProvider><Preview/></DjProvider></QueryClientProvider>;
}
