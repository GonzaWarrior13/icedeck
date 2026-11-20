import React, { useState, useCallback, lazy, Suspense } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useDj } from '@/lib/DjContext';
import { SONGS_KEY, useSongs } from '@/hooks/useDjData';
import SongUploader from '@/components/dj/SongUploader';
import SongLibrary from '@/components/dj/SongLibrary';
import Queue from '@/components/dj/Queue';
import Player from '@/components/dj/Player';
import TagFilter from '@/components/dj/TagFilter';
import QuickAccess from '@/components/dj/QuickAccess';
import SpotifyImport from '@/components/dj/SpotifyImport';
import NormalizeButton from '@/components/dj/NormalizeButton';
import PullToRefresh from '@/components/dj/PullToRefresh';

// The waveform editor is heavy: it only loads when a track is opened for cueing.
const StartPointEditor = lazy(() => import('@/components/dj/StartPointEditor'));

export default function Library() {
  const dj = useDj();
  const queryClient = useQueryClient();
  const { data: songs = [], isLoading: loading, refetch } = useSongs();
  const [filter, setFilter] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [editorSong, setEditorSong] = useState(null);

  const refresh = useCallback(() => refetch(), [refetch]);

  const allTags = ['All', ...Array.from(new Set(songs.flatMap((s) => s.tags || [])))];

  const filtered = songs.filter((s) => {
    const matchText = !filter || (s.title + ' ' + (s.artist || '')).toLowerCase().includes(filter.toLowerCase());
    const matchTag = activeTag === 'All' || (s.tags || []).includes(activeTag);
    return matchText && matchTag;
  });

  const handleUploaded = (song) => {
    queryClient.setQueryData(SONGS_KEY, (prev = []) => [song, ...prev]);
  };

  const handleUpdated = (updated) => {
    queryClient.setQueryData(SONGS_KEY, (prev = []) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    setEditorSong(null);
  };

  const handleDelete = async (song) => {
    if (!confirm(`Delete "${song.title}"?`)) return;
    const previous = queryClient.getQueryData(SONGS_KEY) || [];
    // Optimistic: the row disappears now, and comes back if the server refuses.
    queryClient.setQueryData(SONGS_KEY, previous.filter((s) => s.id !== song.id));
    try {
      await base44.entities.Song.delete(song.id);
    } catch {
      queryClient.setQueryData(SONGS_KEY, previous);
    }
  };

  const toggleTag = async (song, tag) => {
    const tags = song.tags || [];
    const newTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    const previous = queryClient.getQueryData(SONGS_KEY) || [];
    queryClient.setQueryData(SONGS_KEY, previous.map((s) => (s.id === song.id ? { ...s, tags: newTags } : s)));
    try {
      await base44.entities.Song.update(song.id, { tags: newTags });
    } catch {
      queryClient.setQueryData(SONGS_KEY, previous);
    }
  };

  const quickSongs = songs.filter((s) => (s.tags || []).includes('quick')).slice(0, 8);
  const currentSongId = dj.currentSong?.id;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PullToRefresh
        onRefresh={refresh}
        className="flex-1 min-h-0"
        contentClassName="px-5 md:px-10 py-6 md:py-10 space-y-8 md:space-y-10"
      >
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[44px] md:text-[56px] font-semibold leading-[0.95] tracking-[-0.01em]">Library</h1>
              <span className="mb-2 rounded-full border border-border px-2.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                {songs.length} tracks
              </span>
            </div>
            <p className="mt-1 text-[15px] text-muted-foreground">Cue, edit, and fade for game day.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SongUploader onUploaded={handleUploaded} />
            <SpotifyImport
              existingSongs={songs}
              onImported={(created) => queryClient.setQueryData(SONGS_KEY, (prev = []) => [...created, ...prev])}
            />
            <NormalizeButton />
          </div>
        </header>

        <QuickAccess songs={quickSongs} onPlay={dj.playNow} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-10">
          <section className="min-w-0 space-y-5">
            <TagFilter
              filter={filter}
              setFilter={setFilter}
              tags={allTags}
              activeTag={activeTag}
              setActiveTag={setActiveTag}
            />
            <SongLibrary
              songs={filtered}
              loading={loading}
              currentSongId={currentSongId}
              onPlay={dj.playNow}
              onAddQueue={dj.addToQueue}
              onEdit={setEditorSong}
              onDelete={handleDelete}
              onToggleQuick={(s) => toggleTag(s, 'quick')}
            />
          </section>
          <section className="lg:sticky lg:top-6">
            <div className="bg-card border border-border rounded-[14px] h-[420px] lg:h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
              <Queue />
            </div>
          </section>
        </div>
      </PullToRefresh>

      <Player />

      {editorSong && (
        <Suspense fallback={null}>
          <StartPointEditor
            song={editorSong}
            onClose={() => setEditorSong(null)}
            onSave={handleUpdated}
          />
        </Suspense>
      )}
    </div>
  );
}