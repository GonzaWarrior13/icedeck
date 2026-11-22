import React, { useState } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/ThemeProvider';
import { DjProvider, useDj } from '@/lib/DjContext';
import SongLibrary from '@/components/dj/SongLibrary';
import Queue from '@/components/dj/Queue';
import Player from '@/components/dj/Player';
import { SONGS_KEY, PLAYLISTS_KEY, setMigrationToken } from '@/hooks/useDjData';
import { signIn, getTeamSongs, getTeamPlaylists, createPrivateAudioUrl } from '@/api/supabaseClient';

function OriginalInterface() {
  const queryClient = useQueryClient();
  const dj = useDj();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [songs,setSongs] = useState([]);
  const [playlists,setPlaylists] = useState([]);
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [filter,setFilter] = useState('');
  async function connect(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const session = await signIn(email,password);
      setPassword('');
      const [rawSongs, pls] = await Promise.all([
        getTeamSongs(session.access_token),getTeamPlaylists(session.access_token)
      ]);
      // Sign each private MP3 before enabling the original player and queue.
      // Limit concurrent requests to avoid overwhelming Storage.
      const prepared = new Array(rawSongs.length);
      let cursor = 0;
      await Promise.all(Array.from({length: Math.min(6,rawSongs.length)},async () => {
        while(cursor < rawSongs.length) {
          const i=cursor++;
          const song=rawSongs[i];
          const file_url = song.storage_path
            ? await createPrivateAudioUrl(song.storage_path,session.access_token,3600)
            : '';
          prepared[i]={...song,preview_url:'',file_url};
        }
      }));
      setMigrationToken(session.access_token);
      queryClient.setQueryData(SONGS_KEY,prepared);
      queryClient.setQueryData(PLAYLISTS_KEY,pls);
      setSongs(prepared);setPlaylists(pls);setReady(true);
    } catch(err) {setError(err.message || 'Connection failed');}
    finally {setBusy(false);}
  }
  const byId = new Map(songs.map(s=>[s.id,s]));
  const playPlaylist = (pl) => {
    const tracks=pl.song_ids.map(id=>byId.get(id)).filter(Boolean);
    if(tracks.length) dj.playQueueFrom(tracks,0);
  };
  return <div className="min-h-screen bg-background text-foreground">
    {!ready ? <main className="mx-auto max-w-md p-8 space-y-4">
      <h1 className="text-3xl font-bold">IceDeck · Original UI test</h1>
      <p className="text-muted-foreground">Read-only Supabase test. Your Base44 app is untouched.</p>
      <form onSubmit={connect} className="grid gap-3">
        <label>Email<input className="block w-full rounded border p-3 text-black bg-white" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Password<input className="block w-full rounded border p-3 text-black bg-white" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="rounded bg-primary text-primary-foreground p-3" disabled={busy}>{busy?'Preparing private audio links…':'Sign in and load original interface'}</button>
      </form>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </main> : <div className="flex h-screen flex-col">
      <header className="p-4 border-b border-border flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">IceDeck · Supabase original UI</h1>
        <span className="text-sm text-muted-foreground">{songs.length} songs · {playlists.length} setlists · read-only</span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {playlists.map(p=><button key={p.id} className="rounded border border-border bg-card px-3 py-2 hover:bg-secondary" onClick={()=>playPlaylist(p)}>
            ▶ {p.name} ({p.song_ids.length})
          </button>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_336px] gap-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Library</h2>
            <input className="w-full rounded border border-border bg-card p-3 mb-3" placeholder="Search songs…" value={filter} onChange={e=>setFilter(e.target.value)}/>
            <SongLibrary songs={songs.filter(s=>(s.title+' '+(s.artist||'')).toLowerCase().includes(filter.toLowerCase()))}
              currentSongId={dj.currentSong?.id} onPlay={dj.playNow} onAddQueue={dj.addToQueue}/>
          </section>
          <section className="h-[380px] lg:sticky lg:top-0 rounded border border-border bg-card overflow-hidden"><Queue/></section>
        </div>
      </div>
      <Player/>
    </div>}
    {ready && <p className="sr-only">Signed audio URLs expire after one hour. Refresh and sign in again to renew them.</p>}
  </div>;
}
export default function SupabaseOriginalTest(){
  return <ThemeProvider><QueryClientProvider client={queryClientInstance}><DjProvider><OriginalInterface/></DjProvider></QueryClientProvider></ThemeProvider>;
}
