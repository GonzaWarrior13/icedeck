import React, { useState, useEffect, Suspense } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/ThemeProvider';
import DjLayout from '@/components/dj/DjLayout';
import Library from '@/pages/Library';
import Playlists from '@/pages/Playlists';
import SupabaseSettings from '@/pages/SupabaseSettings';
import { SONGS_KEY, PLAYLISTS_KEY, setMigrationData, setMigrationToken } from '@/hooks/useDjData';
import { signIn, getTeamSongs, getTeamPlaylists, createPrivateAudioUrl, setPreviewSession, getMyTeams, setSelectedTeamId, getSignedInUser } from '@/api/supabaseClient';

// The original IceDeck layout and pages, isolated from production Base44.
// MemoryRouter keeps navigation within the test URL.
function OriginalInterface() {
  const queryClient = useQueryClient();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [ready,setReady] = useState(false);
  const [teams,setTeams] = useState([]);
  const [session,setSession] = useState(null);
  const [signedInUser,setSignedInUser] = useState(null);
  const [activeTeam,setActiveTeam] = useState(null);
  const teamRole = activeTeam?.role?.trim()?.toLowerCase() || '';
  const canEdit = ['owner','admin','dj'].includes(teamRole);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function connect(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const signedIn = await signIn(email,password);
      const verifiedUser = await getSignedInUser(signedIn.access_token);
      const available = await getMyTeams(signedIn.access_token, verifiedUser);
      setSignedInUser(verifiedUser);
      setPassword('');
      setSession(signedIn);
      setPreviewSession(signedIn);
      setTeams(available);
      if (!available.length) setError('This account is not assigned to a team. Ask a team owner to add it in Supabase.');
    } catch(err) { setError(err.message || 'Sign-in failed'); }
    finally { setBusy(false); }
  }

  async function openTeam(team) {
    if (!session || !teams.some(t => t.id === team.id)) return;
    setBusy(true); setError('');
    try {
      // Fetch the membership again: a role may have changed since sign-in.
      const freshTeams = await getMyTeams(session.access_token, signedInUser);
      setTeams(freshTeams);
      const currentTeam = freshTeams.find(t => t.id === team.id);
      if (!currentTeam) throw new Error('You no longer belong to this team.');
      setSelectedTeamId(currentTeam.id);
      const [rawSongs, playlists] = await Promise.all([
        getTeamSongs(session.access_token, team.id),
        getTeamPlaylists(session.access_token, team.id),
      ]);
      const songs = new Array(rawSongs.length);
      let cursor = 0;
      await Promise.all(Array.from({length: Math.min(6, rawSongs.length)}, async () => {
        while (cursor < rawSongs.length) {
          const i = cursor++;
          const song = rawSongs[i];
          const file_url = song.storage_path
            ? await createPrivateAudioUrl(song.storage_path, session.access_token, 3600)
            : '';
          songs[i] = {...song, preview_url:'', file_url};
        }
      }));
      setMigrationToken(session.access_token);
      setMigrationData(songs, playlists);
      queryClient.setQueryData(SONGS_KEY, songs);
      queryClient.setQueryData(PLAYLISTS_KEY, playlists);
      setActiveTeam(currentTeam);
      setReady(true);
    } catch(err) { setSelectedTeamId(''); setError(err.message || 'Unable to load team'); }
    finally { setBusy(false); }
  }

  // Recheck privileges when the user returns to the tab, without requiring logout.
  useEffect(() => {
    if (!ready || !activeTeam || !session) return;
    let cancelled = false;
    const checkRole = async () => {
      try {
        const available = await getMyTeams(session.access_token, signedInUser);
        if (cancelled) return;
        const membership = available.find(t => t.id === activeTeam.id);
        if (!membership) {
          leaveTeam();
          setTeams(available);
          setError('You no longer belong to that team.');
          return;
        }
        if (membership.role !== activeTeam.role) {
          setActiveTeam(membership);
          setTeams(available);
        }
      } catch {
        // Database RLS still enforces permissions even when temporarily offline.
      }
    };
    window.addEventListener('focus', checkRole);
    const timer = window.setInterval(checkRole, 15000);
    return () => { cancelled = true; window.removeEventListener('focus', checkRole); window.clearInterval(timer); };
  }, [ready, activeTeam?.id, activeTeam?.role, session]);

  function leaveTeam() {
    setReady(false);
    setActiveTeam(null);
    setSelectedTeamId('');
    setMigrationData([], []);
    queryClient.removeQueries({ queryKey: SONGS_KEY });
    queryClient.removeQueries({ queryKey: PLAYLISTS_KEY });
  }

  if (!ready) return <main className="mx-auto max-w-md p-8 space-y-4 bg-background text-foreground min-h-screen">
    <h1 className="text-3xl font-bold">IceDeck · Supabase interface test</h1>
    <p className="text-muted-foreground">The original IceDeck layout will load after sign-in. Supabase cue points and setlist editing enabled. MP3 uploads are enabled (6 MB test limit); song deletion is enabled with confirmation; Goal horn uses a temporary built-in sound unless a local MP3 is configured. Base44 production unchanged.</p>
    {!session ? <form onSubmit={connect} className="grid gap-3">
      <label>Email<input className="block w-full rounded border p-3 text-black bg-white" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Password<input className="block w-full rounded border p-3 text-black bg-white" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="rounded bg-primary text-primary-foreground p-3" disabled={busy}>{busy?'Preparing private audio links…':'Sign in'}</button>
    </form> : <div className="grid gap-3">
      <h2 className="font-semibold">Choose your team</h2>
      <p className="text-xs text-muted-foreground">Signed in as {signedInUser?.email || signedInUser?.id}</p>
      {teams.map(team => <button
        key={team.id} type="button" disabled={busy}
        className="rounded border border-border bg-card p-3 text-left hover:bg-secondary disabled:opacity-50"
        onClick={() => openTeam(team)}
      >{team.name} <span className="text-xs text-muted-foreground">({team.role})</span></button>)}
      <button type="button" className="text-sm underline" onClick={() => { setSession(null); setSignedInUser(null); setTeams([]); setPreviewSession(null); setSelectedTeamId(''); setError(''); }}>Use another account</button>
    </div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </main>;
  return <MemoryRouter initialEntries={['/']}>
    <div className="fixed top-0 right-0 z-50 flex items-center gap-2 rounded-bl bg-background/95 border border-border p-1 text-xs shadow">
      <span className="max-w-48 truncate">{activeTeam?.name} · {teamRole} · {canEdit ? 'Editor access' : 'READ ONLY'}</span>
      <button className="rounded bg-secondary px-2 py-1 hover:bg-secondary/70" onClick={leaveTeam}>Switch team</button>
    </div>
    <Suspense fallback={<div className="p-6">Loading IceDeck…</div>}>
      <Routes>
        <Route element={<DjLayout/>}>
          <Route path="/" element={<Library migrationReadOnly canEdit={canEdit}/>}/>
          <Route path="/playlists" element={<Playlists migrationReadOnly canEdit={canEdit}/>}/>
          <Route path="/settings" element={<SupabaseSettings user={signedInUser} team={activeTeam}/>}/>
        </Route>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </Suspense>
  </MemoryRouter>;
}
export default function SupabaseOriginalTest(){
  return <ThemeProvider><QueryClientProvider client={queryClientInstance}><OriginalInterface/></QueryClientProvider></ThemeProvider>;
}
