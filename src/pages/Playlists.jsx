import { userFacingError } from '@/lib/userFacingError';
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { saveTeamPlaylist, deleteTeamPlaylist, getTeamPlaylists } from '@/api/supabaseClient';
import { useDj } from '@/lib/DjContext';
import { PLAYLISTS_KEY, SONGS_KEY, songsQueryOptions, usePlaylists, useSongs, getMigrationToken, setMigrationPlaylists } from '@/hooks/useDjData';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Play, Pencil, Shuffle, Target } from 'lucide-react';
import SetlistEditor from '@/components/dj/SetlistEditor';
import Player from '@/components/dj/Player';
import PullToRefresh from '@/components/dj/PullToRefresh';
import ConfirmDialog from '@/components/dj/ConfirmDialog';

export default function Playlists({ migrationReadOnly = false, canEdit = true }) {
  const allowEdits = !migrationReadOnly || canEdit;
  const navigate = useNavigate();
  const dj = useDj();
  const queryClient = useQueryClient();
  const { data: playlists = [], isLoading: loading, isError: listError } = usePlaylists();
  const { data: songs = [] } = useSongs();
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const refresh = useCallback(
    () => Promise.all([
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_KEY }),
      queryClient.invalidateQueries({ queryKey: SONGS_KEY }),
    ]),
    [queryClient],
  );

  const openCreate = () => { if (!allowEdits) return; setSaveError(''); setEditor({ id: null, name: '', songIds: [], hotkey: '' }); };
  const openEdit = (pl) => { if (!allowEdits) return; setSaveError(''); setEditor({ id: pl.id, name: pl.name, songIds: [...(pl.song_ids || [])], hotkey: pl.hotkey || '' }); };

  const handleSave = async (name, songIds, hotkey) => {
    if (!name || !editor || !allowEdits) return;
    if (migrationReadOnly) {
      setSaveError(''); setSaving(true);
      try {
        const token = getMigrationToken();
        if (!token) throw Object.assign(new Error('Session missing'), { status: 401 });
        await saveTeamPlaylist(token, { id: editor.id, name, song_ids: songIds, hotkey });
        const updated = await getTeamPlaylists(token);
        setMigrationPlaylists(updated);
        queryClient.setQueryData(PLAYLISTS_KEY, updated);
        setEditor(null);
        dj.refreshHotkeys();
      } catch (err) { setSaveError(userFacingError(err, 'Couldn’t save the setlist. Try again before closing the editor.')); }
      finally { setSaving(false); }
      return;
    }
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

  const deletePlaylist = (pl) => { if (allowEdits) setDeleteTarget(pl); };

  const confirmDelete = async () => {
    const pl = deleteTarget;
    setDeleteTarget(null);
    if (!pl || !allowEdits) return;
    if (migrationReadOnly) {
      setSaveError(''); setSaving(true);
      try {
        const token = getMigrationToken();
        if (!token) throw Object.assign(new Error('Session missing'), { status: 401 });
        await deleteTeamPlaylist(token, pl.id);
        const updated = await getTeamPlaylists(token);
        setMigrationPlaylists(updated);
        queryClient.setQueryData(PLAYLISTS_KEY, updated);
        dj.refreshHotkeys();
      } catch (err) { setSaveError(userFacingError(err, 'Couldn’t delete the setlist. Refresh the page and try again.')); }
      finally { setSaving(false); }
      return;
    }
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
    dj.playSetlist(pl.id, ordered);
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PullToRefresh
        onRefresh={refresh}
        className="flex-1 min-h-0"
        contentClassName="px-4 md:px-8 pt-5 md:pt-8 pb-6 space-y-6 md:space-y-8 max-w-4xl"
      >
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h1 className="font-display text-[44px] md:text-[56px] font-semibold leading-[0.95] tracking-[-0.01em]">Setlists</h1>
              <span className="type-data mb-2 rounded-[6px] border border-border bg-card px-2 py-0.5 text-muted-foreground">
                {playlists.length}
              </span>
            </div>
            <p className="type-meta mt-1">
              Save tracks in the order you want to play them.
            </p>
          </div>
          {allowEdits && <Button
            onClick={openCreate}
            className="min-h-10 rounded-[8px] bg-foreground text-background hover:bg-foreground/90 font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" /> New setlist
          </Button>}
        </header>

        {allowEdits && editor && (
          <SetlistEditor
            initialName={editor.name}
            initialSongIds={editor.songIds}
            initialHotkey={editor.hotkey}
            songs={songs}
            onCancel={() => { if (!saving) setEditor(null); }}
            saving={saving}
            error={saveError}
            onSave={handleSave}
          />
        )}

        {saveError && !editor && <p role="alert" className="text-sm text-destructive">{saveError}</p>}

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
        ) : listError && !playlists.length ? (
          <p role="alert" className="text-sm text-destructive">Couldn’t load setlists. Refresh the page to try again.</p>
        ) : playlists.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border px-4 py-12 text-center">
            <p className="text-[16px] font-semibold leading-tight">No setlists yet</p>
            <p className="type-meta mt-1.5">{allowEdits ? 'Choose New setlist to add your first one.' : 'Ask a team editor to create a setlist.'}</p>
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
                        <span className="type-data rounded-[6px] border border-border px-1.5 py-px text-[14px] text-muted-foreground md:text-[11px]">
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
                      title={isGoal ? 'Stop playing this setlist after the goal horn' : 'Play this setlist after the goal horn'}
                      aria-label={isGoal ? `Clear default goal setlist ${pl.name}` : `Set ${pl.name} as default goal setlist`}
                      aria-pressed={isGoal}
                    >
                      <Target className="w-4 h-4" aria-hidden="true" />
                    </button>
                    {allowEdits && <button
                      onClick={() => openEdit(pl)}
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Edit setlist"
                      aria-label={`Edit ${pl.name}`}
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>}
                    {allowEdits && <button
                      onClick={() => deletePlaylist(pl)}
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete setlist"
                      aria-label={`Delete ${pl.name}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PullToRefresh>

      <Player />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete setlist?"
        description={deleteTarget ? `This deletes “${deleteTarget.name}”. Its tracks stay in your library.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}