import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/DjContext';
import SongUploader from '@/components/dj/SongUploader';
import SongLibrary from '@/components/dj/SongLibrary';
import Queue from '@/components/dj/Queue';
import Player from '@/components/dj/Player';
import StartPointEditor from '@/components/dj/StartPointEditor';
import TagFilter from '@/components/dj/TagFilter';
import QuickAccess from '@/components/dj/QuickAccess';

export default function Home() {
  const dj = useDj();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [editorSong, setEditorSong] = useState(null);

  const fetchSongs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Song.list('-updated_date', 200);
      setSongs(list);
    } catch (e) {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSongs(); }, [fetchSongs]);

  const allTags = ['All', ...Array.from(new Set(songs.flatMap((s) => s.tags || [])))];

  const filtered = songs.filter((s) => {
    const matchText = !filter || (s.title + ' ' + (s.artist || '')).toLowerCase().includes(filter.toLowerCase());
    const matchTag = activeTag === 'All' || (s.tags || []).includes(activeTag);
    return matchText && matchTag;
  });

  const handleUploaded = (song) => setSongs((prev) => [song, ...prev]);

  const handleUpdated = (updated) => {
    setSongs((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    setEditorSong(null);
  };

  const handleDelete = async (song) => {
    if (!confirm(`Delete "${song.title}"?`)) return;
    await base44.entities.Song.delete(song.id);
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
  };

  const toggleTag = async (song, tag) => {
    const tags = song.tags || [];
    const newTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    await base44.entities.Song.update(song.id, { tags: newTags });
    setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, tags: newTags } : s)));
  };

  const quickSongs = songs.filter((s) => (s.tags || []).includes('quick')).slice(0, 8);
  const currentSongId = dj.currentSong?.id;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 pb-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Music Library</h1>
            <p className="text-sm text-slate-400">{songs.length} tracks · cue, edit, and fade for game day</p>
          </div>
          <SongUploader onUploaded={handleUploaded} />
        </header>

        <QuickAccess songs={quickSongs} onPlay={dj.playNow} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 space-y-4">
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
          <section className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 h-[420px] lg:h-[calc(100vh-7rem)] flex flex-col">
              <Queue />
            </div>
          </section>
        </div>
      </div>

      <Player />

      {editorSong && (
        <StartPointEditor
          song={editorSong}
          onClose={() => setEditorSong(null)}
          onSave={handleUpdated}
        />
      )}
    </div>
  );
}