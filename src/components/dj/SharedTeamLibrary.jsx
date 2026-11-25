import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { getSelectedTeamId, getSharedTeamSongs } from '@/api/supabaseClient';
import { FREE_SHARED_TRACK_LIMIT, readBillingDemoPlan } from '@/lib/billingDemo';
import BillingPreview from '@/components/BillingPreview';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSharedImports } from './SharedImportQueue';

export default function SharedTeamLibrary({ canEdit, teamSongs }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const imports = useSharedImports();
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
  const pending = new Set(imports?.pendingIds);
  const available = capped ? Math.max(0, FREE_SHARED_TRACK_LIMIT - sharedCount - pending.size) : Infinity;
  const atLimit = capped && sharedCount >= FREE_SHARED_TRACK_LIMIT;
  const selected = (library.data ?? [])
    .filter(song => selectedIds.includes(song.id) && !libraryIds.has(song.id) && !pending.has(song.id))
    .slice(0, available);
  const selectedSet = new Set(selected.map(song => song.id));
  const editor = canEdit && imports;
  const plannedCount = sharedCount + pending.size + selected.length;
  const selectionFull = capped && plannedCount >= FREE_SHARED_TRACK_LIMIT;

  function download() {
    if (!editor || !selected.length) return;
    imports.enqueue(selected, capped ? FREE_SHARED_TRACK_LIMIT : Infinity);
    setSelectedIds([]);
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      if (next) setDemoPlan(readBillingDemoPlan(teamId));
      setOpen(next);
    }}>
      <DialogTrigger asChild><Button variant="outline">Shared library</Button></DialogTrigger>
      <DialogContent className="flex flex-col overflow-hidden">
        <DialogTitle className="pr-10">Shared library</DialogTitle>
        <DialogDescription>Select tracks from IceDeck-Main to download to your team’s library.</DialogDescription>
        {editor && demoPlan && sourceTeamId !== teamId && (
          <p role="status" className="text-sm text-primary">Demo Plus is active. You can add more shared tracks.</p>
        )}
        <input aria-label="Search shared library" placeholder="Search title or artist" value={filter}
          onChange={event => setFilter(event.target.value)}
          className="min-h-11 w-full shrink-0 rounded-md border bg-card px-3 text-sm" />
        <div className="min-h-0 flex-1 overflow-y-auto scroll-area">
          {editor && atLimit && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="font-semibold">You’ve reached your shared track limit</p>
              <p className="text-sm text-muted-foreground">Remove a shared track to make room, or try Plus to add more in this demo.</p>
              <BillingPreview teamId={teamId} onPlanChange={setDemoPlan} />
            </div>
          )}
          {library.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading shared songs…</p>}
          {library.isError && <p role="alert" className="text-sm text-destructive">Couldn’t load shared tracks. Close this window and try again.</p>}
          {library.isSuccess && songs.length === 0 && (
            <p className="text-sm text-muted-foreground">{search ? 'No matches. Try another title or artist.' : 'IceDeck-Main hasn’t shared any tracks yet.'}</p>
          )}
          <ul className="divide-y divide-border">
            {songs.map(song => {
              const inLibrary = libraryIds.has(song.id);
              const queued = pending.has(song.id);
              const checked = selectedSet.has(song.id);
              const checkboxId = `shared-track-${song.id}`;
              return (
                <li key={song.id} className="flex items-center gap-3 py-2.5">
                    <label htmlFor={editor && !inLibrary && !queued ? checkboxId : undefined} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                    <span className="break-words text-sm font-medium">{song.title}</span>
                    {song.artist && <span className="break-words text-xs text-muted-foreground">{song.artist}</span>}
                  </label>
                    {(inLibrary || queued) && (
                      <span className="shrink-0 rounded-md border bg-secondary px-2 py-1 text-xs text-muted-foreground">
                        {inLibrary ? 'In library' : 'Queued'}
                      </span>
                    )}
                    {editor && !inLibrary && !queued && (
                    <Checkbox id={checkboxId} className="mr-1 h-6 w-6" checked={checked}
                        disabled={!checked && selectionFull}
                        aria-label={`Select ${song.title}`}
                      onCheckedChange={next => setSelectedIds(previous =>
                        next === true ? [...previous, song.id] : previous.filter(id => id !== song.id))} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {editor && (
          <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-3 ${selectionFull ? 'border-destructive/60' : ''}`}>
            <div className="min-w-0 flex-1">
              <p role="status" className={`text-sm font-medium ${selectionFull ? 'text-destructive' : ''}`}>
                {capped
                  ? `${plannedCount}/${FREE_SHARED_TRACK_LIMIT}`
                  : `${selected.length} selected`}
              </p>
              {selectionFull && <p className="mt-1 text-xs text-muted-foreground">
                {atLimit ? 'Free plan limit reached. Remove a downloaded track or try Plus.'
                  : selected.length ? 'No more slots. Uncheck a track to choose a different one.'
                  : 'Queued tracks are using the remaining slots.'}
              </p>}
              {pending.size > 0 && <p className="text-xs text-muted-foreground">Downloads continue when you close this window.</p>}
              {imports.message && <p role="alert" className="text-xs text-destructive">{imports.message}</p>}
            </div>
            <Button type="button" className="min-h-11 shrink-0" onClick={download} disabled={!selected.length}>
              <Download aria-hidden="true" /> Download
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
