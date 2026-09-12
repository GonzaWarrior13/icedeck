import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/DjContext';
import { Button } from '@/components/ui/button';
import { ListMusic, Plus, Trash2, Play, Pencil, Shuffle, Target } from 'lucide-react';
import SetlistEditor from '@/components/dj/SetlistEditor';
import Player from '@/components/dj/Player';

export default function Playlists() {
  const navigate = useNavigate();
  const dj = useDj();
  const [playlists, setPlaylists] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, sg] = await Promise.all([
        base44.entities.Playlist.list('-updated_date', 100),
        base44.entities.Song.list('-updated_date', 200),
      ]);
      setPlaylists(pl);
      setSongs(sg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => setEditor({ id: null, name: '', songIds: [], hotkey: '' });
  const openEdit = (pl) => setEditor({ id: pl.id, name: pl.name, songIds: [...(pl.song_ids || [])], hotkey: pl.hotkey || '' });

  const handleSave = async (name, songIds, hotkey) => {
    if (!name) return;
    if (editor.id) {
      const updated = await base44.entities.Playlist.update(editor.id, { name, song_ids: songIds, hotkey: hotkey || '' });
      setPlaylists((prev) => prev.map((p) => (p.id === editor.id ? updated : p)));
    } else {
      const created = await base44.entities.Playlist.create({ name, song_ids: songIds, hotkey: hotkey || '' });
      setPlaylists((prev) => [created, ...prev]);
    }
    setEditor(null);
    dj.refreshHotkeys();
  };

  const deletePlaylist = async (pl) => {
    if (!confirm(`Delete setlist "${pl.name}"?`)) return;
    await base44.entities.Playlist.delete(pl.id);
    setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
    dj.refreshHotkeys();
  };

  const resolveSongs = async (pl) => {
    let list = songs;
    try {
      list = await base44.entities.Song.list('-updated_date', 200);
      setSongs(list);
    } catch {}
    const byId = new Map(list.map((s) => [s.id, s]));
    return (pl.song_ids || []).map((id) => byId.get(id)).filter(Boolean);
  };

  const loadPlaylist = async (pl, startIndex = 0) => {
    const ordered = await resolveSongs(pl);
    if (!ordered.length) return;
    dj.playQueueFrom(ordered, startIndex);
    navigate('/');
  };

  const shufflePlaylist = async (pl) => {
    const ordered = await resolveSongs(pl);
    if (!ordered.length) return;
    const weighted = ordered.map((song) => ({ song, count: song.play_count || 0, rand: Math.random() }));
    weighted.sort((a, b) => a.count - b.count || a.rand - b.rand);
    dj.playQueueFrom(weighted.map((w) => w.song), 0);
    navigate('/');
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Setlists</h1>
          <p className="text-sm text-slate-400">Save and reuse queues for intermissions, warmups, and celebrations</p>
        </div>
        <Button onClick={openCreate} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
          <Plus className="w-4 h-4 mr-1" /> New setlist
        </Button>
      </header>

      {editor && (
        <SetlistEditor
          initialName={editor.name}
          initialSongIds={editor.songIds}
          initialHotkey={editor.hotkey}
          songs={songs}
          onCancel={() => setEditor(null)}
          onSave={handleSave}
        />
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
          <ListMusic className="w-6 h-6 mx-auto mb-2 opacity-50" /> No setlists yet. Create one to save a reusable queue.
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((pl) => {
            const count = (pl.song_ids || []).length;
            return (
              <div key={pl.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <button onClick={() => loadPlaylist(pl)} className="w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center hover:bg-cyan-300" title="Play setlist">
                  <Play className="w-4 h-4 fill-current" />
                </button>
                <button onClick={() => shufflePlaylist(pl)} className="w-10 h-10 rounded-full bg-slate-800 text-cyan-300 flex items-center justify-center hover:bg-slate-700 transition" title="Shuffle setlist">
                  <Shuffle className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pl.name}</p>
                  <p className="text-xs text-slate-500">{count} tracks{pl.hotkey ? ` · key ${pl.hotkey.toUpperCase()}` : ''}</p>
                </div>
                <button
                  onClick={() => dj.setGoalSetlist(dj.goalSetlistId === pl.id ? null : pl.id)}
                  className={`p-2 rounded-lg transition ${dj.goalSetlistId === pl.id ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'}`}
                  title={dj.goalSetlistId === pl.id ? 'Default goal setlist — click to clear' : 'Set as default goal setlist'}
                >
                  <Target className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(pl)} className="p-2 rounded-lg text-slate-400 hover:text-cyan-300" title="Edit setlist">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deletePlaylist(pl)} className="p-2 rounded-lg text-slate-500 hover:text-rose-300" title="Delete setlist">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <Player />
    </div>
  );
}