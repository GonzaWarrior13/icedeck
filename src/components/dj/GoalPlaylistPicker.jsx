import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/DjContext';
import { PartyPopper } from 'lucide-react';

export default function GoalPlaylistPicker() {
  const dj = useDj();
  const [playlists, setPlaylists] = useState([]);
  const [songs, setSongs] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [pl, sg] = await Promise.all([
          base44.entities.Playlist.list('-updated_date', 100),
          base44.entities.Song.list('-updated_date', 200),
        ]);
        setPlaylists(pl);
        setSongs(sg);
      } catch (e) {
        /* ignore */
      }
    })();
  }, []);

  const resolve = (id) => {
    if (!id) { dj.setGoalPlaylist([]); return; }
    const pl = playlists.find((p) => p.id === id);
    const ordered = (pl?.song_ids || [])
      .map((sid) => songs.find((s) => s.id === sid))
      .filter(Boolean);
    dj.setGoalPlaylist(ordered);
  };

  return (
    <div className="flex items-center gap-1.5">
      <PartyPopper className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <select
        value={selected}
        onChange={(e) => { setSelected(e.target.value); resolve(e.target.value); }}
        className="bg-slate-800 text-xs text-slate-200 rounded-lg px-2 py-1.5 border border-slate-700 max-w-[150px] truncate focus:outline-none"
        title="Setlist to shuffle-play after the goal horn"
      >
        <option value="">No playlist</option>
        {playlists.map((pl) => (
          <option key={pl.id} value={pl.id}>{pl.name}</option>
        ))}
      </select>
    </div>
  );
}