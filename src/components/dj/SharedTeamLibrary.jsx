import { userFacingError } from '@/lib/userFacingError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { copySharedTeamSong, getSelectedTeamId, getSharedTeamSongs } from '@/api/supabaseClient';
import { FREE_SHARED_TRACK_LIMIT, readBillingDemoPlan } from '@/lib/billingDemo';
import BillingPreview from '@/components/BillingPreview';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function SharedTeamLibrary({ canEdit, teamSongs, onAdded, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [copying, setCopying] = useState(null);
  const [error, setError] = useState('');
  const teamId = getSelectedTeamId();
  const [demoPlan, setDemoPlan] = useState(() => readBillingDemoPlan(teamId));
  const library = useQuery({
    queryKey: ['shared-team-library'], queryFn: getSharedTeamSongs, enabled: open, retry: false,
  });
  const search = filter.trim().toLowerCase();
  const songs = (library.data ?? []).filter(song =>
    `${song.title} ${song.artist || ''}`.toLowerCase().includes(search));
  const libraryIds = new Set(teamSongs.flatMap(song => [song.id, song.shared_source_song_id]));
  const sourceTeamId = library.data?.[0]?.storage_path.split('/')[0];
  const sharedCount = teamSongs.filter(song => song.shared_source_song_id).length;
  const capped = Boolean(sourceTeamId && sourceTeamId !== teamId && !demoPlan);
  const atLimit = capped && sharedCount >= FREE_SHARED_TRACK_LIMIT;

  async function add(song) {
    if (copying || atLimit || libraryIds.has(song.id)) return;
    setCopying(song.id);
    setError('');
    try {
      onAdded(await copySharedTeamSong(song));
    } catch (error) {
      if (error.code === '23505' && error.message.includes('songs_team_shared_source_unique')) {
        setError('This track is already in your library.');
        await onRefresh();
      } else {
        if (error.code === 'audio_upload_incomplete') await onRefresh();
        setError(userFacingError(error, 'Couldn’t copy the track. Check your library before trying again.'));
      }
    } finally {
      setCopying(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      if (copying) return;
      if (next) setDemoPlan(readBillingDemoPlan(teamId));
      setOpen(next);
    }}>
      <DialogTrigger asChild><Button variant="outline">Shared library</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10">Shared library</DialogTitle>
        <DialogDescription>Find tracks from IceDeck-Main and copy them to your team’s library.</DialogDescription>
        {canEdit && capped && (
          <p className="text-sm text-muted-foreground">
            {Math.min(sharedCount, FREE_SHARED_TRACK_LIMIT)} of {FREE_SHARED_TRACK_LIMIT} shared tracks used
          </p>
        )}
        {canEdit && atLimit && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <p className="font-semibold">You’ve reached your shared track limit</p>
            <p className="text-sm text-muted-foreground">Remove a shared track to make room, or try Plus to add more in this demo.</p>
            <BillingPreview teamId={teamId} onPlanChange={setDemoPlan} />
          </div>
        )}
        {canEdit && demoPlan && sourceTeamId !== teamId && (
          <p role="status" className="text-sm text-primary">Demo Plus is active. You can add more shared tracks.</p>
        )}
        <input aria-label="Search shared library" placeholder="Search title or artist" value={filter}
          onChange={event => setFilter(event.target.value)}
          className="min-h-11 w-full rounded-md border bg-card px-3 text-sm" />
        {library.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading shared songs…</p>}
        {library.isError && <p role="alert" className="text-sm text-destructive">Couldn’t load shared tracks. Close this window and try again.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {library.isSuccess && songs.length === 0 && (
          <p className="text-sm text-muted-foreground">{search ? 'No matches. Try another title or artist.' : 'IceDeck-Main hasn’t shared any tracks yet.'}</p>
        )}
        <ul className="divide-y divide-border">
          {songs.map(song => {
            const inLibrary = libraryIds.has(song.id);
            return (
              <li key={song.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{song.title}</p>
                  {song.artist && <p className="break-words text-xs text-muted-foreground">{song.artist}</p>}
                </div>
                {canEdit && (
                  <Button variant="outline" className="min-h-11 shrink-0" disabled={Boolean(copying) || inLibrary || atLimit}
                    aria-label={inLibrary ? `${song.title} is already in your library` : `Add ${song.title} to library`}
                    onClick={() => add(song)}>
                    {!inLibrary && <Plus aria-hidden="true" />}
                    {copying === song.id ? 'Adding…' : inLibrary ? 'In library' : 'Add'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
