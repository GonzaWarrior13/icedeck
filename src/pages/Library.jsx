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
        contentClassName="px-4 md:px-8 pt-4 pb-6 md:py-8 space-y-5 md:space-y-7"
      >
        <header className="space-y-3 md:flex md:flex-wrap md:items-end md:justify-between md:gap-4 md:space-y-0">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h1 className="font-display text-[34px] md:text-[46px] font-semibold leading-none tracking-[-0.01em]">Library</h1>
              <span className="text-[13px] tabular-nums text-muted-foreground">{songs.length} tracks</span>
            </div>
            <p className="mt-1 hidden text-[15px] text-muted-foreground md:block">Cue, edit, and fade for game day.</p>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <SongUploader onUploaded={handleUploaded} />
            <SpotifyImport
              existingSongs={songs}
              onImported={(created) => queryClient.setQueryData(SONGS_KEY, (prev = []) => [...created, ...prev])}
            />
            <NormalizeButton />
          </div>
        </header>

        <QuickAccess songs={quickSongs} onPlay={dj.playNow} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_336px] gap-6 lg:gap-7">
          <section className="min-w-0 space-y-4 md:space-y-5">
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
            <div className="flex h-[280px] flex-col overflow-hidden border-y border-border md:h-[380px] md:rounded-[14px] md:border md:bg-card lg:h-[calc(100vh-8rem)]">
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