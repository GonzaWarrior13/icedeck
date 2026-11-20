import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/DjContext';
import { PLAYLISTS_KEY, SONGS_KEY, playlistsQueryOptions, songsQueryOptions, usePlaylists, useSongs } from '@/hooks/useDjData';
import { Button } from '@/components/ui/button';
import { ListMusic, Plus, Trash2, Play, Pencil, Shuffle, Target } from 'lucide-react';
import SetlistEditor from '@/components/dj/SetlistEditor';
import Player from '@/components/dj/Player';
import PullToRefresh from '@/components/dj/PullToRefresh';

export default function Playlists() {
  const navigate = useNavigate();
  const dj = useDj();
  const queryClient = useQueryClient();
  const { data: playlists = [], isLoading: loading } = usePlaylists();
  const { data: songs = [] } = useSongs();
  const [editor, setEditor] = useState(null);

  const refresh = useCallback(
    () => Promise.all([
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_KEY }),
      queryClient.invalidateQueries({ queryKey: SONGS_KEY }),
    ]),
    [queryClient],
  );

  const openCreate = () => setEditor({ id: null, name: '', songIds: [], hotkey: '' });
  const openEdit = (pl) => setEditor({ id: pl.id, name: pl.name, songIds: [...(pl.song_ids || [])], hotkey: pl.hotkey || '' });

  const handleSave = async (name, songIds, hotkey) => {
    if (!name || !editor) return;
    const editorId = editor.id;
    const previous = queryClient.getQueryData(PLAYLISTS_KEY) || [];
    const payload = { name, song_ids: songIds, hotkey: hotkey || '' };

    if (editorId) {
      queryClient.setQueryData(PLAYLISTS_KEY, previous.map((p) => (p.id === editorId ? { ...p, ...payload } : p)));
      try {
        await base44.entities.Playlist.update(editorId, payload);
      } catch {
        queryClient.setQueryData(PLAYLISTS_KEY, previous);
      }
    } else {
      const created = await base44.entities.Playlist.create(payload);
      queryClient.setQueryData(PLAYLISTS_KEY, [created, ...previous]);
    }
    setEditor(null);
    dj.refreshHotkeys();
  };

  const deletePlaylist = async (pl) => {
    if (!confirm(`Delete setlist "${pl.name}"?`)) return;
    const previous = queryClient.getQueryData(PLAYLISTS_KEY) || [];
    queryClient.setQueryData(PLAYLISTS_KEY, previous.filter((p) => p.id !== pl.id));
    try {
      await base44.entities.Playlist.delete(pl.id);
    } catch {
      queryClient.setQueryData(PLAYLISTS_KEY, previous);
    }
    dj.refreshHotkeys();
  };

  const resolveSongs = async (pl) => {
    let list = songs;
    try {
      // One fetch, shared with every other page through the query cache.
      list = await queryClient.fetchQuery({ ...songsQueryOptions, staleTime: 0 });
    } catch {
      /* fall back to the cached list */
    }
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
    <PullToRefresh
      onRefresh={refresh}
      className="flex-1 min-h-0 md:flex-none md:overflow-visible"
      contentClassName="p-4 md:p-6 space-y-5 max-w-4xl"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Setlists</h1>
          <p className="text-sm text-muted-foreground">Save and reuse queues for intermissions, warmups, and celebrations</p>
        </div>
        <Button onClick={openCreate} className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> New setlist
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
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          <ListMusic className="w-6 h-6 mx-auto mb-2 opacity-50" aria-hidden="true" /> No setlists yet. Create one to save a reusable queue.
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((pl) => {
            const count = (pl.song_ids || []).length;
            return (
              <div key={pl.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-card/60 border border-border">
                <button
                  onClick={() => loadPlaylist(pl)}
                  className="shrink-0 min-h-11 min-w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition"
                  title="Play setlist"
                  aria-label={`Play ${pl.name}`}
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                </button>
                <button
                  onClick={() => shufflePlaylist(pl)}
                  className="shrink-0 min-h-11 min-w-11 rounded-full bg-secondary text-primary flex items-center justify-center hover:bg-secondary/80 transition"
                  title="Shuffle setlist"
                  aria-label={`Shuffle ${pl.name}`}
                >
                  <Shuffle className="w-4 h-4" aria-hidden="true" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pl.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{count} tracks{pl.hotkey ? ` · key ${pl.hotkey.toUpperCase()}` : ''}</p>
                </div>
                <div className="flex items-center gap-0.5 max-md:w-full max-md:justify-end">
                  <button
                    onClick={() => dj.setGoalSetlist(dj.goalSetlistId === pl.id ? null : pl.id)}
                    className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg transition ${dj.goalSetlistId === pl.id ? 'text-amber-400' : 'text-muted-foreground hover:text-amber-300'}`}
                    title={dj.goalSetlistId === pl.id ? 'Default goal setlist — click to clear' : 'Set as default goal setlist'}
                    aria-label={dj.goalSetlistId === pl.id ? `Clear default goal setlist ${pl.name}` : `Set ${pl.name} as default goal setlist`}
                    aria-pressed={dj.goalSetlistId === pl.id}
                  >
                    <Target className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => openEdit(pl)}
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary"
                    title="Edit setlist"
                    aria-label={`Edit ${pl.name}`}
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => deletePlaylist(pl)}
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
                    title="Delete setlist"
                    aria-label={`Delete ${pl.name}`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Player />
    </PullToRefresh>
  );
}