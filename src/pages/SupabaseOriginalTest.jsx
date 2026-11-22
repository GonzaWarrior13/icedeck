import React, { useState, useEffect, Suspense } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/ThemeProvider';
import DjLayout from '@/components/dj/DjLayout';
import Library from '@/pages/Library';
import SimpleConsole from '@/components/dj/SimpleConsole';
import { useSimpleMode } from '@/lib/simpleMode';
import Playlists from '@/pages/Playlists';
import SupabaseSettings from '@/pages/SupabaseSettings';
import { completeSpotifyStandaloneAuth } from '@/lib/spotifyStandalone';
import { SONGS_KEY, PLAYLISTS_KEY, setMigrationData, setMigrationToken } from '@/hooks/useDjData';
import { signIn, signUp, requestPasswordReset, changePassword, signOut, startGoogleSignIn, createTeam, getStoredPreviewSession, getFreshPreviewToken, getTeamSongs, getTeamPlaylists, createPrivateAudioUrl, setPreviewSession, getMyTeams, setSelectedTeamId, getSignedInUser } from '@/api/supabaseClient';

// The original IceDeck layout and pages, isolated from production Base44.
function SupabaseHome({ canEdit }) {
  const { enabled } = useSimpleMode();
  return enabled ? <SimpleConsole /> : <Library migrationReadOnly canEdit={canEdit} />;
}
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
  const [authMode,setAuthMode] = useState('signin');
  const [authNotice,setAuthNotice] = useState('');
  const [recoveryToken,setRecoveryToken] = useState('');
  const [newTeamName,setNewTeamName] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function adoptSession(signedIn) {
    setPreviewSession(signedIn);
    const verifiedUser = await getSignedInUser(signedIn.access_token);
    const available = await getMyTeams(signedIn.access_token, verifiedUser);
    setSignedInUser(verifiedUser);
    setSession(signedIn);
    setTeams(available);
    setPassword('');
    return available;
  }

  // Restore only this browser tab's session after reload or OAuth return.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (window.location.pathname === '/spotify-callback') {
          try {
            await completeSpotifyStandaloneAuth();
            if (!cancelled) setAuthNotice('Spotify connected. Open the Spotify button to browse your playlists.');
          } catch (spotifyError) {
            if (!cancelled) setAuthNotice('Spotify: ' + spotifyError.message);
            window.history.replaceState({}, '', '/');
          }
        }
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const oauthToken = hash.get('access_token');
        const oauthRefresh = hash.get('refresh_token');
        if (oauthToken && oauthRefresh) {
          window.history.replaceState({}, '', window.location.pathname);
          if (hash.get('type') === 'recovery') {
            setPreviewSession(null);
            setRecoveryToken(oauthToken);
            setAuthMode('reset');
            return;
          }
          if (!cancelled) await adoptSession({
            access_token: oauthToken,
            refresh_token: oauthRefresh,
            expires_in: Number(hash.get('expires_in') || 3600),
          });
          return;
        }
        const stored = getStoredPreviewSession();
        if (!stored) return;
        setPreviewSession(stored);
        const freshToken = await getFreshPreviewToken();
        if (!cancelled) await adoptSession({ ...getStoredPreviewSession(), access_token: freshToken });
      } catch (err) {
        setPreviewSession(null);
        if (!cancelled) setError('Session expired. Please sign in again.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function connect(e) {
    e.preventDefault(); setBusy(true); setError(''); setAuthNotice('');
    try {
      if (authMode === 'signup') {
        await signUp(email,password);
        setPassword('');
        setAuthMode('signin');
        setAuthNotice('Registration submitted. Check your email for verification, then sign in. You can create a team once verified.');
      } else if (authMode === 'forgot') {
        await requestPasswordReset(email);
        setAuthMode('signin');
        setAuthNotice('If your account exists, a password reset email has been requested.');
      } else if (authMode === 'reset') {
        if (!recoveryToken) throw new Error('The recovery link is missing or expired.');
        if (password.length < 6) throw new Error('Use a password with at least 6 characters.');
        await changePassword(recoveryToken,password);
        setRecoveryToken('');
        setPassword('');
        setAuthMode('signin');
        setAuthNotice('Password updated. Please sign in.');
      } else {
        await adoptSession(await signIn(email,password));
      }
    } catch(err) { setError(err.message || 'Authentication failed'); }
    finally { setBusy(false); }
  }

  async function createNewTeam(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await createTeam(newTeamName.trim());
      setNewTeamName('');
      const available = await getMyTeams(await getFreshPreviewToken(), signedInUser);
      setTeams(available);
      setAuthNotice('Team created. Select it below.');
    } catch(err) { setError(err.message || 'Could not create team'); }
    finally { setBusy(false); }
  }

  async function logout() {
    try { await signOut(await getFreshPreviewToken()); } catch {}
    setPreviewSession(null);
    setMigrationToken(null);
    setSelectedTeamId('');
    setMigrationData([], []);
    queryClient.removeQueries({ queryKey: SONGS_KEY });
    queryClient.removeQueries({ queryKey: PLAYLISTS_KEY });
    setReady(false);
    setSession(null);
    setSignedInUser(null);
    setActiveTeam(null);
    setTeams([]);
    setEmail('');
    setPassword('');
    setAuthMode('signin');
    setError('');
  }

  async function syncTeams() {
    const available = await getMyTeams(await getFreshPreviewToken(), signedInUser);
    setTeams(available);
    if (activeTeam) {
      const updated = available.find(t => t.id === activeTeam.id);
      if (!updated) leaveTeam();
      else setActiveTeam(updated);
    }
  }

  async function openTeam(team) {
    if (!session || !teams.some(t => t.id === team.id)) return;
    setBusy(true); setError('');
    try {
      // Fetch the membership again: a role may have changed since sign-in.
      const token = await getFreshPreviewToken();
      const freshTeams = await getMyTeams(token, signedInUser);
      setTeams(freshTeams);
      const currentTeam = freshTeams.find(t => t.id === team.id);
      if (!currentTeam) throw new Error('You no longer belong to this team.');
      setSelectedTeamId(currentTeam.id);
      const [rawSongs, playlists] = await Promise.all([
        getTeamSongs(token, team.id),
        getTeamPlaylists(token, team.id),
      ]);
      const songs = new Array(rawSongs.length);
      let cursor = 0;
      await Promise.all(Array.from({length: Math.min(6, rawSongs.length)}, async () => {
        while (cursor < rawSongs.length) {
          const i = cursor++;
          const song = rawSongs[i];
          const file_url = song.storage_path
            ? await createPrivateAudioUrl(song.storage_path, token, 3600)
            : '';
          songs[i] = {...song, preview_url:'', file_url};
        }
      }));
      setMigrationToken(token);
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
        const available = await getMyTeams(await getFreshPreviewToken(), signedInUser);
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
    <p className="text-muted-foreground">The original IceDeck layout will load after sign-in. Supabase cue points and setlist editing enabled. MP3 uploads support up to 50 MB where your Supabase plan allows it; song deletion uses confirmation; the locally hosted goal horn is /goal-horn.mp3. Base44 production unchanged.</p>
    {!session ? <form onSubmit={connect} className="grid gap-3">
      <h2 className="font-semibold">{authMode === 'signup' ? 'Create your account' : authMode === 'forgot' ? 'Reset your password' : authMode === 'reset' ? 'Choose a new password' : 'Sign in'}</h2>
      {authMode !== 'reset' && <label>Email<input className="block w-full rounded border p-3 text-black bg-white" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
      {authMode !== 'forgot' && <label>{authMode === 'reset' ? 'New password' : 'Password'}<input className="block w-full rounded border p-3 text-black bg-white" type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      <button className="rounded bg-primary text-primary-foreground p-3 disabled:opacity-60" disabled={busy}>{busy ? 'Working…' : authMode === 'signup' ? 'Register' : authMode === 'forgot' ? 'Email reset link' : authMode === 'reset' ? 'Save new password' : 'Sign in'}</button>
      {authMode === 'signin' && <>
        <button type="button" className="rounded border border-border p-2" onClick={() => { setError(''); startGoogleSignIn(); }}>Sign in with Google</button>
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <button type="button" className="underline" onClick={() => { setAuthMode('signup'); setError(''); }}>Create account</button>
          <button type="button" className="underline" onClick={() => { setAuthMode('forgot'); setError(''); }}>Forgot password?</button>
        </div>
      </>}
      {authMode !== 'signin' && <button type="button" className="text-sm underline" onClick={() => { setAuthMode('signin'); setError(''); }}>Back to sign in</button>}
    </form> : <div className="grid gap-3">
      <h2 className="font-semibold">Choose your team</h2>
      <p className="text-xs text-muted-foreground">Signed in as {signedInUser?.email || signedInUser?.id}</p>
      {teams.map(team => <button
        key={team.id} type="button" disabled={busy}
        className="rounded border border-border bg-card p-3 text-left hover:bg-secondary disabled:opacity-50"
        onClick={() => openTeam(team)}
      >{team.name} <span className="text-xs text-muted-foreground">({team.role})</span></button>)}
      <form onSubmit={createNewTeam} className="flex gap-2">
        <input required maxLength={120} className="min-w-0 flex-1 rounded border border-border bg-background p-2" placeholder="New team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
        <button disabled={busy || !newTeamName.trim()} className="rounded bg-primary text-primary-foreground px-3 disabled:opacity-50">Create team</button>
      </form>
      <button type="button" className="text-sm underline" onClick={logout}>Sign out</button>
    </div>}
    {authNotice && <p role="status" className="text-primary text-sm">{authNotice}</p>}
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
          <Route path="/" element={<SupabaseHome canEdit={canEdit}/>}/>
          <Route path="/playlists" element={<Playlists migrationReadOnly canEdit={canEdit}/>}/>
          <Route path="/settings" element={<SupabaseSettings user={signedInUser} team={activeTeam} onLogout={logout} onTeamsChanged={syncTeams}/>}/>
        </Route>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </Suspense>
  </MemoryRouter>;
}
export default function SupabaseOriginalTest(){
  return <ThemeProvider><QueryClientProvider client={queryClientInstance}><OriginalInterface/></QueryClientProvider></ThemeProvider>;
}
