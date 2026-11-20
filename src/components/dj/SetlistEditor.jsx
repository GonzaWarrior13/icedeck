import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, ChevronUp, ChevronDown, Trash2, Plus, Search } from 'lucide-react';
import { formatTime } from '@/lib/audio';

export default function SetlistEditor({ initialName = '', initialSongIds = [], initialHotkey = '', songs = [], onCancel, onSave }) {
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
    <div className="bg-card/60 border border-border rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs text-muted-foreground">Setlist name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warmup mix" className="bg-background border-border" autoFocus />
        </div>
        <Button onClick={() => onSave(name.trim(), ids, hotkey)} disabled={!name.trim()} className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          <Save className="w-4 h-4 mr-1" aria-hidden="true" /> Save
        </Button>
        <Button variant="outline" onClick={onCancel} aria-label="Cancel setlist editing" className="min-h-11 min-w-11 bg-transparent border-border text-foreground hover:bg-secondary">
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs text-muted-foreground shrink-0">Hotkey</Label>
        <button
          onClick={() => setRecording((r) => !r)}
          aria-label={recording ? 'Press a key to assign' : hotkey ? `Hotkey ${hotkey.toUpperCase()}, change it` : 'Set a hotkey'}
          className={`min-h-11 min-w-11 px-3 py-2 rounded-lg text-sm border transition ${recording ? 'border-primary text-primary bg-primary/10 animate-pulse' : hotkey ? 'border-border bg-background text-foreground hover:border-muted-foreground/50' : 'border-dashed border-border bg-background/40 text-muted-foreground hover:border-muted-foreground/50'}`}
        >
          {recording ? 'Press a key…' : hotkey ? hotkey.toUpperCase() : 'Set key'}
        </button>
        {hotkey && !recording && (
          <button onClick={() => setHotkey('')} className="min-h-11 px-2 text-xs text-muted-foreground hover:text-destructive">Clear</button>
        )}
        <span className="text-xs text-muted-foreground">Press this key anytime to play the setlist instantly.</span>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Tracks in this setlist ({selected.length})</p>
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg py-6 text-center">Add tracks below.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto scroll-area pr-1">
            {selected.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5 p-2 rounded-lg bg-background/60 border border-border">
                <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.artist || 'Unknown'} · {formatTime(s.duration)}</p>
                </div>
                <button onClick={() => moveUp(i)} disabled={i === 0} className="min-h-11 min-w-11 flex items-center justify-center rounded text-muted-foreground hover:text-primary disabled:opacity-30" aria-label={`Move ${s.title} up`}><ChevronUp className="w-4 h-4" aria-hidden="true" /></button>
                <button onClick={() => moveDown(i)} disabled={i === selected.length - 1} className="min-h-11 min-w-11 flex items-center justify-center rounded text-muted-foreground hover:text-primary disabled:opacity-30" aria-label={`Move ${s.title} down`}><ChevronDown className="w-4 h-4" aria-hidden="true" /></button>
                <button onClick={() => removeAt(i)} className="min-h-11 min-w-11 flex items-center justify-center rounded text-muted-foreground hover:text-destructive" aria-label={`Remove ${s.title} from setlist`}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Add tracks</p>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" aria-label="Search your library" className="min-h-11 pl-9 bg-background border-border" />
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto scroll-area pr-1">
          {available.map((s) => (
            <button key={s.id} onClick={() => addSong(s.id)} className="w-full min-h-11 flex items-center justify-between gap-2 p-2 rounded-lg bg-background/40 border border-border hover:border-muted-foreground/50 text-left" aria-label={`Add ${s.title} to setlist`}>
              <span className="truncate text-sm">{s.title} <span className="text-muted-foreground">· {s.artist || 'Unknown'}</span></span>
              <Plus className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            </button>
          ))}
          {!available.length && <p className="text-xs text-muted-foreground text-center py-4">No matching tracks.</p>}
        </div>
      </div>
    </div>
  );
}