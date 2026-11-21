import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/DjContext';
import { PLAYLISTS_KEY, SONGS_KEY, playlistsQueryOptions, songsQueryOptions, usePlaylists, useSongs } from '@/hooks/useDjData';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Play, Pencil, Shuffle, Target } from 'lucide-react';
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
      contentClassName="px-5 md:px-10 py-6 md:py-10 space-y-8 md:space-y-10 max-w-4xl"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[44px] md:text-[56px] font-semibold leading-[0.95] tracking-[-0.01em]">Setlists</h1>
            <span className="type-data mb-2 rounded-[6px] border border-border bg-card px-2 py-0.5 text-muted-foreground">
              {playlists.length}
            </span>
          </div>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Save and reuse queues for intermissions, warmups, and celebrations.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="min-h-10 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 font-semibold"
        >
          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" /> New setlist
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
        <div className="flex flex-col gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 rounded-[8px] border border-border bg-card py-2 pl-4 pr-2">
              <div className="w-9 h-9 rounded-[8px] bg-secondary animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded-full bg-secondary animate-pulse" />
                <div className="h-2.5 w-20 rounded-full bg-secondary/70 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border px-4 py-12 text-center">
          <p className="text-[16px] font-semibold leading-tight">No setlists yet</p>
          <p className="type-meta mt-1.5">Create one to save a reusable queue.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {playlists.map((pl) => {
            const count = (pl.song_ids || []).length;
            const isGoal = dj.goalSetlistId === pl.id;
            return (
              <div
                key={pl.id}
                className={`relative flex flex-wrap items-center gap-2.5 min-h-14 rounded-[8px] border py-2 pl-4 pr-2 transition-colors ${
                  isGoal
                    ? 'border-signal/40 bg-signal/5'
                    : 'border-border bg-card hover:bg-secondary'
                }`}
              >
                {isGoal && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-signal"
                    aria-hidden="true"
                  />
                )}
                <button
                  onClick={() => loadPlaylist(pl)}
                  className="shrink-0 w-9 h-9 rounded-[8px] border border-border text-primary flex items-center justify-center hover:border-primary/60 hover:bg-primary/10 transition-colors"
                  title="Play setlist"
                  aria-label={`Play ${pl.name}`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                </button>
                <button
                  onClick={() => shufflePlaylist(pl)}
                  className="shrink-0 w-9 h-9 rounded-[8px] text-muted-foreground flex items-center justify-center hover:text-foreground hover:bg-secondary transition-colors"
                  title="Shuffle setlist"
                  aria-label={`Shuffle ${pl.name}`}
                >
                  <Shuffle className="w-4 h-4" aria-hidden="true" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`type-track truncate ${isGoal ? 'text-signal' : ''}`}>{pl.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="type-data text-muted-foreground">{count} tracks</span>
                    {pl.hotkey && (
                      <span className="type-data rounded-[6px] border border-border px-1.5 py-px text-[11px] text-muted-foreground">
                        {pl.hotkey.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 max-md:w-full max-md:justify-end">
                  <button
                    onClick={() => dj.setGoalSetlist(isGoal ? null : pl.id)}
                    className={`min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-[8px] transition-colors ${
                      isGoal ? 'text-signal' : 'text-muted-foreground hover:text-signal hover:bg-secondary'
                    }`}
                    title={isGoal ? 'Default goal setlist — click to clear' : 'Set as default goal setlist'}
                    aria-label={isGoal ? `Clear default goal setlist ${pl.name}` : `Set ${pl.name} as default goal setlist`}
                    aria-pressed={isGoal}
                  >
                    <Target className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => openEdit(pl)}
                    className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Edit setlist"
                    aria-label={`Edit ${pl.name}`}
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => deletePlaylist(pl)}
                    className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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