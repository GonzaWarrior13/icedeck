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
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs text-slate-400">Setlist name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warmup mix" className="bg-slate-950 border-slate-700" autoFocus />
        </div>
        <Button onClick={() => onSave(name.trim(), ids, hotkey)} disabled={!name.trim()} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
          <Save className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button variant="outline" onClick={onCancel} className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs text-slate-400 shrink-0">Hotkey</Label>
        <button
          onClick={() => setRecording((r) => !r)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition ${recording ? 'border-cyan-400 text-cyan-300 bg-cyan-400/10 animate-pulse' : hotkey ? 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-600' : 'border-dashed border-slate-700 bg-slate-950/40 text-slate-500 hover:border-slate-600'}`}
        >
          {recording ? 'Press a key…' : hotkey ? hotkey.toUpperCase() : 'Set key'}
        </button>
        {hotkey && !recording && (
          <button onClick={() => setHotkey('')} className="text-xs text-slate-500 hover:text-rose-300">Clear</button>
        )}
        <span className="text-[11px] text-slate-600">Press this key anytime to play the setlist instantly.</span>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1.5">Tracks in this setlist ({selected.length})</p>
        {selected.length === 0 ? (
          <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg py-6 text-center">Add tracks below.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {selected.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-500 w-5 text-right tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{s.title}</p>
                  <p className="truncate text-[11px] text-slate-500">{s.artist || 'Unknown'} · {formatTime(s.duration)}</p>
                </div>
                <button onClick={() => moveUp(i)} disabled={i === 0} className="p-1 rounded text-slate-400 hover:text-cyan-300 disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => moveDown(i)} disabled={i === selected.length - 1} className="p-1 rounded text-slate-400 hover:text-cyan-300 disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
                <button onClick={() => removeAt(i)} className="p-1 rounded text-slate-500 hover:text-rose-300" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1.5">Add tracks</p>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" className="pl-9 bg-slate-950 border-slate-700" />
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {available.map((s) => (
            <button key={s.id} onClick={() => addSong(s.id)} className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-slate-700 text-left">
              <span className="truncate text-sm">{s.title} <span className="text-slate-500">· {s.artist || 'Unknown'}</span></span>
              <Plus className="w-4 h-4 text-cyan-300 shrink-0" />
            </button>
          ))}
          {!available.length && <p className="text-xs text-slate-600 text-center py-4">No matching tracks.</p>}
        </div>
      </div>
    </div>
  );
}