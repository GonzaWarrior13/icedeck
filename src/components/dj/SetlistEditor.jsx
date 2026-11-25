import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, ChevronUp, ChevronDown, Trash2, Plus, Search } from 'lucide-react';
import { formatTime } from '@/lib/audio';

export default function SetlistEditor({ initialName = '', initialSongIds = [], initialHotkey = '', songs = [], onCancel, onSave, saving = false, error = '' }) {
  const [name, setName] = useState(initialName);
  const [ids, setIds] = useState(initialSongIds);
  const [hotkey, setHotkey] = useState(initialHotkey);
  const [recording, setRecording] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => { setName(initialName); setIds(initialSongIds); setHotkey(initialHotkey || ''); }, [initialName, initialSongIds, initialHotkey]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRecording(false); return; }
      if (e.key === 'Backspace') { setHotkey(''); setRecording(false); return; }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (/^(f\d{1,2})$/i.test(key) || /^[a-z0-9]$/.test(key)) {
        setHotkey(key);
        setRecording(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording]);

  const selected = useMemo(() => ids.map((id) => songs.find((s) => s.id === id)).filter(Boolean), [ids, songs]);
  const available = useMemo(() => {
    const idSet = new Set(ids);
    const q = query.toLowerCase();
    return songs.filter((s) => !idSet.has(s.id) && (s.title + ' ' + (s.artist || '')).toLowerCase().includes(q));
  }, [songs, ids, query]);

  const addSong = (id) => setIds((p) => [...p, id]);
  const removeAt = (i) => setIds((p) => p.filter((_, x) => x !== i));
  const moveUp = (i) => setIds((p) => { if (i <= 0) return p; const n = [...p]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  const moveDown = (i) => setIds((p) => { if (i >= p.length - 1) return p; const n = [...p]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; });

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 md:p-8 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="section-label">Setlist name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Warmup mix"
            className="mt-2 h-12 bg-transparent border-0 border-b border-border rounded-none px-0 font-display text-2xl md:text-3xl font-semibold focus-visible:ring-0 focus-visible:border-primary"
            autoFocus
          />
        </div>
        <Button
          onClick={() => onSave(name.trim(), ids, hotkey)}
          disabled={!name.trim() || saving}
          className="min-h-10 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 font-semibold"
        >
          <Save className="w-4 h-4 mr-1.5" aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          aria-label="Cancel setlist editing"
          className="min-h-10 min-w-10 rounded-[10px] bg-transparent border-border text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="section-label shrink-0">Hotkey</Label>
        <button
          onClick={() => setRecording((r) => !r)}
          aria-label={recording ? 'Press the key you want to use' : hotkey ? `Hotkey ${hotkey.toUpperCase()}, change it` : 'Set a hotkey'}
          className={`min-h-10 min-w-10 px-3 rounded-full border text-sm tabular-nums transition-colors ${
            recording
              ? 'border-primary text-primary bg-primary/10'
              : hotkey
                ? 'border-border bg-card text-foreground hover:border-muted-foreground/40'
                : 'border-dashed border-border text-muted-foreground hover:border-muted-foreground/40'
          }`}
        >
          {recording ? 'Press a key…' : hotkey ? hotkey.toUpperCase() : 'Set key'}
        </button>
        {hotkey && !recording && (
          <button onClick={() => setHotkey('')} className="min-h-11 px-2 text-xs text-muted-foreground hover:text-destructive">
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground">Use this key to play the setlist.</span>
      </div>

      <div>
        <p className="section-label mb-2">Tracks in this setlist ({selected.length})</p>
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-[10px] py-8 text-center">
            Add tracks below.
          </p>
        ) : (
          <div className="divide-y divide-border max-h-64 overflow-y-auto scroll-area">
            {selected.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 py-2 min-h-14">
                <span className="text-xs tabular-nums text-muted-foreground w-5 text-right">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="type-track truncate">{s.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <p className="type-meta truncate">{s.artist || 'Unknown'}</p>
                    <span className="type-meta text-muted-foreground/50" aria-hidden="true">·</span>
                    <span className="type-data shrink-0 text-muted-foreground">{formatTime(s.duration)}</span>
                  </div>
                </div>
                <button onClick={() => moveUp(i)} disabled={i === 0} className="min-h-11 min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={`Move ${s.title} up`}><ChevronUp className="w-4 h-4" aria-hidden="true" /></button>
                <button onClick={() => moveDown(i)} disabled={i === selected.length - 1} className="min-h-11 min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={`Move ${s.title} down`}><ChevronDown className="w-4 h-4" aria-hidden="true" /></button>
                <button onClick={() => removeAt(i)} className="min-h-11 min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:text-destructive" aria-label={`Remove ${s.title} from setlist`}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="section-label mb-2">Add tracks</p>
        <div className="relative mb-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your tracks"
            aria-label="Search your library"
            className="h-11 pl-10 rounded-[10px] bg-card border-transparent focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/60"
          />
        </div>
        <div className="max-h-56 overflow-y-auto scroll-area divide-y divide-border">
          {available.map((s) => (
            <button key={s.id} onClick={() => addSong(s.id)} className="w-full min-h-12 flex items-center justify-between gap-2 py-2 text-left hover:text-foreground" aria-label={`Add ${s.title} to setlist`}>
              <span className="truncate text-sm">{s.title} <span className="text-muted-foreground">· {s.artist || 'Unknown'}</span></span>
              <Plus className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            </button>
          ))}
          {!available.length && <p className="text-xs text-muted-foreground text-center py-6">{query.trim() ? 'No matching tracks. Try a different search.' : 'No tracks left to add. Upload more in Library.'}</p>}
        </div>
      </div>
    </div>
  );
}
