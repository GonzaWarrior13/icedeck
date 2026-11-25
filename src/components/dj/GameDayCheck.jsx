import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { playlistsQueryOptions, songsQueryOptions } from '@/hooks/useDjData';
import { useDj } from '@/lib/DjContext';

export default function GameDayCheck() {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState('idle');
  const testContext = useRef(null);
  const dj = useDj();
  const songs = useQuery({ ...songsQueryOptions, enabled: open });
  const setlists = useQuery({ ...playlistsQueryOptions, enabled: open });
  const ready = songs.isSuccess && setlists.isSuccess;
  const checking = songs.isFetching || setlists.isFetching;
  const { playlists, issues, keys } = useMemo(() => {
    const tracks = new Map((songs.data ?? []).map(song => [song.id, song]));
    const playlists = setlists.data ?? [];
    const issues = [];
    const keys = new Map();

    for (const { id, name, hotkey, song_ids: ids = [] } of playlists) {
      const key = hotkey?.trim().toLowerCase();
      if (key) keys.set(key, [...(keys.get(key) ?? []), name]);

      const missing = ids.filter(trackId => !tracks.get(trackId)?.file_url);
      if (!ids.length) issues.push({ id, name, detail: 'No tracks' });
      else if (missing.length) {
        const names = missing.map(trackId => tracks.get(trackId)?.title || 'Removed track');
        issues.push({ id, name, detail: `Audio unavailable: ${names.join(', ')}` });
      }
    }
    return { playlists, issues, keys };
  }, [songs.data, setlists.data]);
  const goal = playlists.find(setlist => setlist.id === dj.goalSetlistId);

  function checkLibrary() {
    void songs.refetch();
    void setlists.refetch();
  }

  useEffect(() => () => {
    const context = testContext.current;
    testContext.current = null;
    if (context) void context.close().catch(() => {});
  }, [open]);

  async function playTestTone() {
    if (testContext.current) return;
    if (!dj.masterVolume) {
      setSound('muted');
      return;
    }
    let context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      testContext.current = context;
      setSound('playing');
      await context.resume();
      if (testContext.current !== context) return;

      const tone = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      tone.frequency.value = 660;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(dj.masterVolume * 0.075, now + 0.05);
      gain.gain.setValueAtTime(dj.masterVolume * 0.075, now + 0.35);
      gain.gain.linearRampToValueAtTime(0, now + 0.55);
      tone.connect(gain).connect(context.destination);
      tone.onended = () => {
        if (testContext.current !== context) return;
        testContext.current = null;
        void context.close().catch(() => {});
        setSound('played');
      };
      tone.start(now);
      tone.stop(now + 0.55);
    } catch {
      if (context && testContext.current !== context) return;
      testContext.current = null;
      if (context) void context.close().catch(() => {});
      setSound('failed');
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      if (next) { setSound('idle'); checkLibrary(); }
      setOpen(next);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-10 shrink-0 px-2.5">
          <ClipboardCheck aria-hidden="true" /> Game Day Check
        </Button>
      </DialogTrigger>
      <DialogContent onKeyDown={event => event.stopPropagation()}>
        <DialogTitle className="pr-10">Game Day Check</DialogTitle>
        <DialogDescription>Check your music and speakers before warmups.</DialogDescription>
        <section className="space-y-2 rounded-lg border bg-card p-3">
          <h3 className="text-sm font-semibold">Setlist audio</h3>
          {checking && <p role="status" className="text-sm text-muted-foreground">Checking setlists…</p>}
          {!checking && (songs.isError || setlists.isError) && (
            <p role="alert" className="text-sm text-destructive">Couldn’t check the library. Check your connection and try again.</p>
          )}
          {ready && !checking && (
            playlists.length === 0 ? <p className="text-sm text-muted-foreground">No setlists yet. Create one in Setlists.</p>
              : issues.length === 0 ? <p className="text-sm text-primary">Audio is available for all {playlists.length} {playlists.length === 1 ? 'setlist' : 'setlists'}.</p>
                : <ul className="space-y-2 text-sm">
                  {issues.map(({ id, name, detail }) => (
                    <li key={id} className="break-words">
                      <span className="font-medium">{name}</span>
                      <span className="block text-xs text-destructive">{detail}</span>
                    </li>
                  ))}
                </ul>
          )}
          <Button variant="outline" size="sm" disabled={checking} type="button"
            onClick={checkLibrary}>Check again</Button>
        </section>
        <section className="space-y-1 rounded-lg border bg-card p-3">
          <h3 className="text-sm font-semibold">Goal setlist</h3>
          <p className="break-words text-sm font-medium">
            {!dj.goalSetlistId ? 'No setlist selected'
              : goal ? goal.name
                : setlists.isError ? 'Couldn’t check the selection'
                  : setlists.isSuccess && !setlists.isFetching ? 'Selected setlist is missing' : 'Checking selection…'}
          </p>
          <p className="text-xs text-muted-foreground">
            {!dj.goalSetlistId ? 'Goal horn only. Choose a goal setlist in Setlists.'
              : goal ? 'After the horn, DropDeck shuffles this setlist.'
                : setlists.isError ? 'Choose Check again to retry.'
                  : setlists.isSuccess && !setlists.isFetching ? 'Choose another goal setlist in Setlists.' : ''}
          </p>
        </section>
        <section className="space-y-2 rounded-lg border bg-card p-3">
          <h3 className="text-sm font-semibold">Hotkeys</h3>
          <p className="text-sm text-muted-foreground">
            <kbd className="mr-2 rounded border px-1.5 py-0.5 text-xs text-foreground">G</kbd>
            Goal horn
          </p>
          {ready && keys.size === 0 && <p className="text-xs text-muted-foreground">No setlist hotkeys assigned. Add them in Setlists.</p>}
          <ul className="space-y-1">
            {[...keys].map(([key, names]) => (
              <li key={key} className="break-words text-sm text-muted-foreground">
                <kbd className="mr-2 rounded border px-1.5 py-0.5 text-xs text-foreground">{key.toUpperCase()}</kbd>
                {names.join(', ')}
                {key === 'g' ? <span className="ml-2 text-xs text-destructive">G is reserved for goals.</span>
                  : names.length > 1 && <span className="ml-2 text-xs text-destructive">Used by multiple setlists.</span>}
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2 rounded-lg border bg-card p-3">
          <h3 className="text-sm font-semibold">Speaker check</h3>
          <p className="text-sm text-muted-foreground">Play a short tone through this device’s audio output.</p>
          <Button type="button" disabled={sound === 'playing'} onClick={playTestTone}>
            <Volume2 aria-hidden="true" /> {sound === 'playing' ? 'Playing…' : 'Test audio'}
          </Button>
          {sound === 'played' && <p role="status" className="text-sm text-muted-foreground">Did it come through the rink speakers? If not, check your device’s audio output.</p>}
          {sound === 'muted' && <p role="alert" className="text-sm text-destructive">DropDeck is muted. Turn up the player volume, then try again.</p>}
          {sound === 'failed' && <p role="alert" className="text-sm text-destructive">Couldn’t play the test tone. Check your browser audio settings and try again.</p>}
        </section>
      </DialogContent>
    </Dialog>
  );
}
