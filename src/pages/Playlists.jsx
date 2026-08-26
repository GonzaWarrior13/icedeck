import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/DjContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ListMusic, Plus, Trash2, Play, Save, X } from 'lucide-react';

export default function Playlists() {
  const navigate = useNavigate();
  const dj = useDj();
  const [playlists, setPlaylists] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);

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

  const createPlaylist = async () => {
    if (!name.trim()) return;
    const created = await base44.entities.Playlist.create({
      name: name.trim(),
      song_ids: selected,
    });
    setPlaylists((prev) => [created, ...prev]);
    setName('');
    setSelected([]);
    setCreating(false);
  };

  const deletePlaylist = async (pl) => {
    if (!confirm(`Delete setlist "${pl.name}"?`)) return;
    await base44.entities.Playlist.delete(pl.id);
    setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
  };

  const loadPlaylist = (pl) => {
    const ordered = (pl.song_ids || [])
      .map((id) => songs.find((s) => s.id === id))
      .filter(Boolean);
    if (!ordered.length) return;
    dj.playQueueFrom(ordered, 0);
    navigate('/');
  };

  const toggleSelect = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Setlists</h1>
          <p className="text-sm text-slate-400">Save and reuse queues for intermissions, warmups, and celebrations</p>
        </div>
        <Button onClick={() => setCreating((c) => !c)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
          <Plus className="w-4 h-4 mr-1" /> New setlist
        </Button>
      </header>

      {creating && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs text-slate-400">Setlist name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warmup mix" className="bg-slate-950 border-slate-700" />
            </div>
            <Button onClick={createPlaylist} disabled={!name.trim()} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)} className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400">{selected.length} tracks selected</p>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {songs.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSelect(s.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-sm ${on ? 'bg-cyan-400/10 border-cyan-400/40' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'}`}
                >
                  <span className="truncate">{s.title} <span className="text-slate-500">· {s.artist || 'Unknown'}</span></span>
                  <span className={`text-xs ${on ? 'text-cyan-300' : 'text-slate-600'}`}>{on ? '✓' : '+'}</span>
                </button>
              );
            })}
          </div>
        </div>
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
                <button onClick={() => loadPlaylist(pl)} className="w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center hover:bg-cyan-300">
                  <Play className="w-4 h-4 fill-current" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pl.name}</p>
                  <p className="text-xs text-slate-500">{count} tracks</p>
                </div>
                <button onClick={() => deletePlaylist(pl)} className="p-2 rounded-lg text-slate-500 hover:text-rose-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}