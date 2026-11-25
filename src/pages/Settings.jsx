import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Loader2, Mail, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { usePlaylists } from '@/hooks/useDjData';
import { useSimpleMode } from '@/lib/simpleMode';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function Settings() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: playlists = [] } = usePlaylists();
  const { enabled: simpleMode, playlistIds, setEnabled, setPlaylistIds, togglePlaylist } = useSimpleMode();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const toggleSimpleMode = (on) => {
    // First time on: start with every setlist picked, then trim the list.
    if (on && playlistIds.length === 0) setPlaylistIds(playlists.map((p) => p.id));
    setEnabled(on);
  };

  const deleteAccount = async () => {
    setError('');
    setDeleting(true);
    try {
      await base44.functions.invoke('DeleteAccount', {});
      await base44.auth.logout('/login');
    } catch (e) {
      setError(e?.status === 409 ? 'Transfer any teams you own before deleting your account.' : 'Couldn’t delete your account. Try again or contact support.');
      setDeleting(false);
    }
  };

  const initial = (user?.full_name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="px-5 md:px-10 py-6 md:py-10 space-y-10 max-w-[720px]">
      <header>
        <h1 className="workspace-title">Settings</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Your account and this device.</p>
      </header>

      <section className="space-y-4">
        <p className="section-label">Account</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading account…
          </div>
        ) : (
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-secondary text-primary font-display text-xl font-semibold flex items-center justify-center">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold leading-tight">{user?.full_name || 'Signed in'}</p>
              <p className="truncate text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" /> {user?.email || '—'}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-border pt-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="section-label">Simple mode</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Game-day view with play/pause, the goal horn, and only the setlists you pick.
            </p>
          </div>
          <Switch
            checked={simpleMode}
            onCheckedChange={toggleSimpleMode}
            aria-label="Simple mode"
            className="shrink-0 mt-1"
          />
        </div>

        {simpleMode && (
          <div className="space-y-2 pt-1">
            <p className="section-label">Setlists shown</p>
            {playlists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Create a setlist before choosing which ones to show.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6">
                {playlists.map((pl) => (
                  <label key={pl.id} className="flex items-center gap-3 min-h-11 rounded-[8px] hover:bg-secondary/50">
                    <Checkbox
                      checked={playlistIds.includes(pl.id)}
                      onCheckedChange={() => togglePlaylist(pl.id)}
                      aria-label={pl.name}
                    />
                    <span className="truncate text-sm flex-1">{pl.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{(pl.song_ids || []).length}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="border-t border-border pt-8 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-destructive" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive">Delete account</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[560px]">
          Deleting your account permanently removes your login and your access to this Rinkbeats workspace.
          You will be signed out immediately and cannot sign back in with the same account. Tracks and
          setlists you added stay in the shared library for the rest of the team.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-[10px] p-3">
            {error}
          </p>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="min-h-11 rounded-[10px] border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive bg-transparent"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 mr-2" aria-hidden="true" />}
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-popover border-border rounded-[14px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-[32px] font-semibold leading-none">Delete your account?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This cannot be undone. Your login is removed and you are signed out right away.
                The shared music library and setlists are not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11 rounded-[10px]">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteAccount}
                className="min-h-11 rounded-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
              >
                Yes, delete my account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
