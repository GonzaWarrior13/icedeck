import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Loader2, Mail, ShieldAlert, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const deleteAccount = async () => {
    setError('');
    setDeleting(true);
    try {
      await base44.functions.invoke('DeleteAccount', {});
      await base44.auth.logout('/login');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not delete your account.');
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-8 space-y-5 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your account and this device</p>
      </header>

      <section className="bg-card/60 border border-border rounded-2xl p-4 space-y-4">
        <h2 className="text-sm font-medium">Account</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading account…
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserRound className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{user?.full_name || 'Signed in'}</p>
              <p className="truncate text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" /> {user?.email || '—'}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="bg-card/60 border border-destructive/40 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-destructive" aria-hidden="true" />
          <h2 className="text-sm font-medium text-destructive">Delete account</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Deleting your account permanently removes your login and your access to this IceDeck workspace.
          You will be signed out immediately and cannot sign back in with the same account. Tracks and
          setlists you added stay in the shared library for the rest of the team.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2">
            {error}
          </p>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="min-h-11" disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 mr-2" aria-hidden="true" />}
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Your login is removed and you are signed out right away.
                The shared music library and setlists are not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteAccount}
                className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
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