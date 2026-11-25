import { userFacingError } from '@/lib/userFacingError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { copySharedTeamSong, getSharedTeamSongs } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function SharedTeamLibrary({ canEdit, onAdded }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [copying, setCopying] = useState(null);
  const [added, setAdded] = useState([]);
  const [error, setError] = useState('');
  const library = useQuery({
    queryKey: ['shared-team-library'], queryFn: getSharedTeamSongs, enabled: open, retry: false,
  });
  const search = filter.trim().toLowerCase();
  const songs = (library.data ?? []).filter(song =>
    `${song.title} ${song.artist || ''}`.toLowerCase().includes(search));

  async function add(song) {
    setCopying(song.id);
    setError('');
    try {
      onAdded(await copySharedTeamSong(song));
      setAdded(previous => [...previous, song.id]);
    } catch (error) {
      setError(userFacingError(error, 'Couldn’t copy the track. Check your library before trying again.'));
    } finally {
      setCopying(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!copying) setOpen(next); }}>
      <DialogTrigger asChild><Button variant="outline">Shared library</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10">Shared library</DialogTitle>
        <DialogDescription>Find tracks from IceDeck-Main and copy them to your team’s library.</DialogDescription>
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
          {songs.map(song => (
            <li key={song.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{song.title}</p>
                {song.artist && <p className="break-words text-xs text-muted-foreground">{song.artist}</p>}
              </div>
              {canEdit && (
                <Button variant="outline" className="min-h-11 shrink-0" disabled={Boolean(copying) || added.includes(song.id)}
                  aria-label={`Add ${song.title} to library`} onClick={() => add(song)}>
                  <Plus aria-hidden="true" /> {copying === song.id ? 'Adding…' : added.includes(song.id) ? 'Added' : 'Add'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
