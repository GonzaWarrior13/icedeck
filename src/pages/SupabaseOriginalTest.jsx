import React, { useState, useEffect, Suspense } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/ThemeProvider';
import DjLayout from '@/components/dj/DjLayout';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Loader2 } from 'lucide-react';
import Library from '@/pages/Library';
import SimpleConsole from '@/components/dj/SimpleConsole';
import { useSimpleMode } from '@/lib/simpleMode';
import Playlists from '@/pages/Playlists';
import SupabaseSettings from '@/pages/SupabaseSettings';
import { SONGS_KEY, PLAYLISTS_KEY, setMigrationData, setMigrationToken } from '@/hooks/useDjData';
import { signIn, requestPasswordReset, verifyPasswordSetupToken, changePassword, signOut, getStoredPreviewSession, getFreshPreviewToken, getTeamSongs, getTeamPlaylists, createPrivateAudioUrl, setPreviewSession, getMyTeams, setSelectedTeamId, getSignedInUser } from '@/api/supabaseClient';

// The original RinkBeats layout and pages, isolated from production Base44.
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
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const search = new URLSearchParams(window.location.search);
        const oauthToken = hash.get('access_token');
        const oauthRefresh = hash.get('refresh_token');
        const type = hash.get('type') || search.get('type');
        const isInvite = type === 'invite';
        const passwordSetup = isInvite || type === 'recovery' || search.get('password-recovery') === '1';
        const tokenHash = search.get('token_hash');
        if (passwordSetup && tokenHash) {
          const recovered = await verifyPasswordSetupToken(tokenHash, isInvite ? 'invite' : 'recovery');
          if (!recovered?.access_token) throw new Error('The password setup link is invalid or expired.');
          setPreviewSession(null);
          setRecoveryToken(recovered.access_token);
          setAuthMode('reset');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        if (passwordSetup && oauthToken) {
          setPreviewSession(null);
          setRecoveryToken(oauthToken);
          setAuthMode('reset');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        if (oauthToken && oauthRefresh) {
          window.history.replaceState({}, '', window.location.pathname);
          if (!cancelled) await adoptSession({
            access_token: oauthToken,
            refresh_token: oauthRefresh,
            expires_in: Number(hash.get('expires_in') || 3600),
          });
          return;
        }
        if (passwordSetup) {
          setAuthMode('forgot');
          setError('This link is missing a valid token. Request a fresh link.');
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
      if (authMode === 'forgot') {
        await requestPasswordReset(email);
        setAuthMode('signin');
        setAuthNotice('If your account exists, a password reset email has been requested.');
      } else if (authMode === 'reset') {
        if (!recoveryToken) throw new Error('The password setup link is missing or expired.');
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
          const audioUrlExpiresAt = Date.now() + 59 * 60_000;
          const file_url = song.storage_path
            ? await createPrivateAudioUrl(song.storage_path, token, 3600).catch(() => '')
            : '';
          songs[i] = {...song, file_url, audioUrlExpiresAt: file_url ? audioUrlExpiresAt : 0};
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

  if (!ready) {
    const heading = session ? 'Choose your team' : {
      signin: 'Sign in',
      forgot: 'Reset your password',
      reset: 'Set your password',
    }[authMode];
    const submitLabel = {
      signin: 'Sign in',
      forgot: 'Send reset link',
      reset: 'Save password',
    }[authMode];
    const inputClass = 'mt-1.5 min-h-12 bg-background px-3 text-base';
    const goTo = mode => {
      setAuthMode(mode);
      setPassword('');
      setError('');
      setAuthNotice('');
    };

    return (
      <AuthLayout title={heading} subtitle={session ? signedInUser?.email : authMode === 'forgot'
        ? 'Enter the email address associated with your account.' : undefined}>
        {authNotice && <p role="status" className="mb-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{authNotice}</p>}
        {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {!session ? (
          <form onSubmit={connect} className="space-y-4">
            {authMode !== 'reset' && <label className="block text-sm font-medium">
              Email address
              <Input className={inputClass} type="email" autoComplete="email" autoCapitalize="none"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </label>}
            {authMode !== 'forgot' && <label className="block text-sm font-medium">
              {authMode === 'reset' ? 'New password' : 'Password'}
              <Input className={inputClass} type="password"
                autoComplete={authMode === 'reset' ? 'new-password' : 'current-password'}
                minLength={authMode === 'reset' ? 6 : undefined}
                value={password} onChange={e => setPassword(e.target.value)} required />
            </label>}
            <Button type="submit" className="min-h-12 w-full gap-2 font-semibold" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              {busy ? 'Working…' : submitLabel}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 w-full" disabled={busy}
              onClick={() => goTo(authMode === 'signin' ? 'forgot' : 'signin')}>
              {authMode === 'signin' ? 'Forgot password?' : 'Back to sign in'}
            </Button>
          </form>
        ) : (
          <div className="space-y-2">
            {!teams.length && <p className="text-sm text-muted-foreground">No teams are assigned to this account. Ask your team administrator for access.</p>}
            {teams.map(team => (
              <Button key={team.id} type="button" disabled={busy} variant="outline"
                className="min-h-12 w-full justify-between gap-3 text-left" onClick={() => openTeam(team)}>
                <span className="min-w-0 truncate">{team.name}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{team.role}</span>
              </Button>
            ))}
            {busy && <p role="status" className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Opening team…
            </p>}
            <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={logout} disabled={busy}>Sign out</Button>
          </div>
        )}
      </AuthLayout>
    );
  }

  return <MemoryRouter initialEntries={['/']}>
    <Suspense fallback={<div className="p-6">Loading RinkBeats…</div>}>
      <Routes>
        <Route element={<DjLayout teamName={activeTeam?.name} teamRole={teamRole} onSwitchTeam={leaveTeam} />}>
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
