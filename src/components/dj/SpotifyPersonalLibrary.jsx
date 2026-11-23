import React, { useEffect, useId, useRef, useState } from 'react';
import Queue from '@/components/dj/Queue';
import SongCard from '@/components/dj/SongCard';
import { createPortal } from 'react-dom';
import { spotifyConnected } from '@/lib/spotifyStandalone';
import { addPersonalSpotifyTrack, readPersonalSpotifyTracks, removePersonalSpotifyTrack, updatePersonalSpotifyTrack, readSpotifyCollections, saveSpotifyCollections } from '@/lib/spotifyPersonalLibrary';

import { mountPersonalSpotify } from '@/lib/spotifyPersonalPlayer';

export default function SpotifyPersonalLibrary({ dj, open, onOpen, filter, activeTag, rowsTarget, queueTarget, onCounts, playback, onPlayback, startQueued, onQueueStarted }) {
  const [tracks, setTracks] = useState(readPersonalSpotifyTracks);
  const [collections, setCollections] = useState(readSpotifyCollections);
  const [editingId, setEditingId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const connected = spotifyConnected(true);
  const root = useRef(null);
  const controller = useRef(null);
  const currentDj = useRef(dj);
  currentDj.current = dj;
  const [ready, setReady] = useState(false);
  const onEnd = useRef(null);
  const editingTrack = tracks.find(track => track.id === editingId);
  const byId = new Map(tracks.map(track => [track.id, track]));
  const queue = collections.queue.filter(id => byId.has(id));

  useEffect(() => {
    const refreshTracks = () => setTracks(readPersonalSpotifyTracks());
    window.addEventListener('icedeck:spotify-library', refreshTracks);
    return () => window.removeEventListener('icedeck:spotify-library', refreshTracks);
  }, []);

  function changeCollections(change) {
    try {
      setCollections(saveSpotifyCollections(change(readSpotifyCollections())));
    } catch (cause) {
      setError(cause.message);
      onOpen();
    }
  }

  function playQueued(index = 0) {
    const next = queue[index];
    if (!next || currentDj.current.goalPlaying) return;
    if (!ready) { onOpen(); return; }
    changeCollections(value => ({...value, queue: value.queue.filter((_, i) => i !== index)}));
    controller.current?.playTrack(byId.get(next));
  }
  onEnd.current = () => playQueued();
  const playCurrentQueue = useRef(null);
  playCurrentQueue.current = playQueued;
  useEffect(() => {
    if (!startQueued || !ready) return;
    onQueueStarted();
    playCurrentQueue.current();
  }, [startQueued, onQueueStarted, ready]);

  function saveTrackChanges(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const start = Number(fields.get('start'));
    const rawEnd = fields.get('end');
    const end = rawEnd === '' ? null : Number(rawEnd);
    if (end !== null && end <= start) {
      setError('End time must be after the start time.');
      return;
    }
    setTracks(updatePersonalSpotifyTrack(editingTrack.id, {start_point: start, end_point: end}));
    setEditingId(null);
    setError('');
  }

  useEffect(() => {
    controller.current = mountPersonalSpotify(root.current, {
      setReady,
      onPlayback,
      onTrackEnded: id => onEnd.current?.(id),
      beforePlay() {
        if (currentDj.current.goalPlaying) throw new Error('Wait for the goal horn to finish.');
        currentDj.current.audio?.pause();
      },
    });
    return () => controller.current.dispose();
  }, [onPlayback]);

  useEffect(() => {
    if (dj.isPlaying || dj.goalPlaying) controller.current?.interrupt();
  }, [dj.isPlaying, dj.goalPlaying]);

  useEffect(() => {
    if (!playback) return;
    function onSpace(event) {
      if (event.code !== 'Space' || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
        event.target?.closest?.('input, textarea, button, select, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (playback.isPlaying) playback.pause();
      else playback.play();
    }
    window.addEventListener('keydown', onSpace, true);
    return () => window.removeEventListener('keydown', onSpace, true);
  }, [playback]);

  async function addTrack(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setTracks(await addPersonalSpotifyTrack(input));
      setInput('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function removeTrack(id) {
    setError('');
    try {
      if (playback?.currentSong.id === id) controller.current?.interrupt();
      setTracks(removePersonalSpotifyTrack(id));
      changeCollections(value => ({
        queue: value.queue.filter(trackId => trackId !== id),
        setlists: value.setlists.map(list => ({...list, trackIds: list.trackIds.filter(trackId => trackId !== id)})),
      }));
    } catch (cause) {
      setError(cause.message);
    }
  }

  const visibleTracks = tracks.filter(track =>
    (activeTag === 'All' || track.tags?.includes(activeTag))
    && (track.title + ' ' + track.artist).toLowerCase().includes(filter.toLowerCase()));
  const starred = tracks.some(track => track.tags?.includes('quick'));

  useEffect(() => {
    onCounts({ total: tracks.length, visible: visibleTracks.length, starred });
  }, [onCounts, tracks.length, visibleTracks.length, starred]);

  return (
    <>
    <section hidden={!open} ref={root} aria-label="Personal Spotify library" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Spotify tracks</h2>
      <p id="status" role="status" className="text-sm text-muted-foreground">Checking Spotify connection…</p>
      <p id="error" role="alert" className="text-sm text-destructive" hidden />
      <button id="connect" type="button" className="rounded-md border border-border px-3 py-2" hidden>Connect Spotify</button>
      {connected ? (
        <form onSubmit={addTrack}>
          <label htmlFor={inputId} className="mb-1 block text-sm">Spotify track link to save</label>
          <div className="flex flex-wrap gap-2">
            <input id={inputId} value={input} onChange={event => setInput(event.target.value)}
              required placeholder="https://open.spotify.com/track/…"
              className="min-w-0 flex-1 rounded-md border border-border bg-background p-2" />
            <button type="submit" disabled={busy} className="rounded-md border border-border px-3 py-2 disabled:opacity-50">
              {busy ? 'Adding…' : 'Add to Library'}
            </button>
          </div>
        </form>
      ) : null}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {editingTrack && (
        <form key={editingTrack.id} onSubmit={saveTrackChanges} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <p className="w-full text-sm font-medium">{editingTrack.title}</p>
          <label className="text-sm">Start (seconds)
            <input name="start" type="number" min="0" max={editingTrack.duration || undefined} step="0.01" required
              defaultValue={editingTrack.start_point || 0} className="block w-28 rounded border border-border bg-background p-2" />
          </label>
          <label className="text-sm">End (seconds)
            <input name="end" type="number" min="0" max={editingTrack.duration || undefined} step="0.01"
              defaultValue={editingTrack.end_point ?? ''} className="block w-28 rounded border border-border bg-background p-2" />
          </label>
          <button className="rounded border border-border px-3 py-2 text-sm">Save cue points</button>
          <button type="button" className="px-2 py-2 text-sm underline" onClick={() => setEditingId(null)}>Cancel</button>
        </form>
      )}
      <div id="controls" className="space-y-3 border-t border-border pt-3" hidden>
        <button id="disconnect" type="button" className="text-sm underline">Disconnect Spotify</button>
      </div>
    </section>
    {queueTarget && createPortal(<Queue spotify={{
      tracks: queue.map(id => byId.get(id)),
      active: Boolean(playback),
      play: playQueued,
      clear: () => {
        controller.current?.interrupt();
        changeCollections(value => ({...value, queue: []}));
      },
      remove: index => changeCollections(value => ({...value, queue: value.queue.filter((_, i) => i !== index)})),
      reorder: (from, to) => changeCollections(value => {
        const ordered = [...queue];
        const [moved] = ordered.splice(from, 1);
        ordered.splice(to, 0, moved);
        return {...value, queue: ordered};
      }),
    }} />, queueTarget)}
    {rowsTarget && createPortal(visibleTracks.map(track => (
      <SongCard key={track.id}
        song={{...track, spotifyUrl: 'https://open.spotify.com/track/' + track.id}}
        isActive={playback?.currentSong.id === track.id}
        canPlay={!dj.goalPlaying && (!connected || ready)}
        onPlay={() => {
          if (ready) controller.current.playTrack(track);
          else onOpen();
        }}
        onToggleQuick={() => setTracks(updatePersonalSpotifyTrack(track.id, {
          tags: track.tags?.includes('quick') ? [] : ['quick'],
        }))}
        onAddQueue={() => {
          changeCollections(value => ({...value, queue: [...value.queue, track.id]}));
        }}
        onEdit={() => { setEditingId(track.id); setError(''); onOpen(); }}
        onDelete={() => {
          onOpen();
          removeTrack(track.id);
        }} />
    )), rowsTarget)}
    </>
  );
}
