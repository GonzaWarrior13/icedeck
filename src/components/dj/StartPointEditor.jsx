import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import {
  decodeAudioFile, computePeaks, suggestStartPoint, formatTime, parseTime,
} from '@/lib/audio';
import Waveform from './Waveform';
import { Loader2, Play, Pause, Sparkles, Save, Wand2, Scissors } from 'lucide-react';

export default function StartPointEditor({ song, onClose, onSave }) {
  const [peaks, setPeaks] = useState(null);
  const [duration, setDuration] = useState(song?.duration || 0);
  const [start, setStart] = useState(song?.start_point || 0);
  const [end, setEnd] = useState(song?.end_point || null);
  const [startInput, setStartInput] = useState(formatTime(song?.start_point || 0));
  const [endInput, setEndInput] = useState(song?.end_point ? formatTime(song.end_point) : '');
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [volume, setVolume] = useState(song?.volume != null ? song.volume : 100);
  const [error, setError] = useState('');
  const bufRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = song?.preview_url || song?.file_url;
      if (!url) return;
      try {
        setAnalyzing(true);
        const buf = await decodeAudioFile(url);
        if (cancelled) return;
        bufRef.current = buf;
        setPeaks(computePeaks(buf, 700));
        setDuration(buf.duration);
      } catch (e) {
        setError('Could not analyze audio (waveform unavailable). You can still set a start point manually.');
      } finally {
        setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
      if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
    };
  }, [song]);

  const stopPreview = () => {
    if (previewRef.current) { previewRef.current.pause(); }
    setPreviewing(false);
    setPreviewTime(0);
  };

  const togglePreview = () => {
    if (previewing) { stopPreview(); return; }
    const url = song?.preview_url || song?.file_url;
    if (!url) return;
    if (!previewRef.current) previewRef.current = new Audio();
    const a = previewRef.current;
    a.src = url;
    a.currentTime = start;
    a.volume = (volume / 100);
    a.play().catch(() => {});
    setPreviewing(true);
    a.onended = () => { setPreviewing(false); setPreviewTime(0); };
    a.ontimeupdate = () => setPreviewTime(a.currentTime);
  };

  const handleSuggest = () => {
    if (!bufRef.current) return;
    const s = suggestStartPoint(bufRef.current);
    setSuggestion(s);
    setStart(s.start);
    setStartInput(formatTime(s.start));
  };

  const applyStartInput = (val) => {
    setStartInput(val);
    const t = parseTime(val);
    setStart(t);
  };
  const applyEndInput = (val) => {
    setEndInput(val);
    if (!val) { setEnd(null); return; }
    const t = parseTime(val);
    setEnd(t);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.Song.update(song.id, {
        start_point: start,
        end_point: end,
        volume,
      });
      onSave?.({ id: song.id, start_point: start, end_point: end, volume });
    } catch (e) {
      setError('Save failed: ' + (e.message || 'error'));
    } finally {
      setSaving(false);
    }
  };

  const displayTime = previewing ? previewTime : start;

  return (
    <Dialog open={!!song} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-cyan-400" /> Start Point — {song?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2">{error}</p>}

          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
            {analyzing ? (
              <div className="flex items-center justify-center h-20 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing audio…
              </div>
            ) : (
              <Waveform
                peaks={peaks}
                duration={duration}
                start={start}
                end={end}
                currentTime={displayTime}
                onSeek={(t) => { if (previewRef.current) previewRef.current.currentTime = t; }}
                onStartChange={(t) => { setStart(t); setStartInput(formatTime(t)); }}
                onEndChange={(t) => { setEnd(t); setEndInput(formatTime(t)); }}
                height={84}
              />
            )}
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span className="tabular-nums">{formatTime(displayTime)}</span>
              <span className="tabular-nums">/ {formatTime(duration)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Start point (mm:ss or sec)</Label>
              <Input
                value={startInput}
                onChange={(e) => applyStartInput(e.target.value)}
                className="bg-slate-950 border-slate-700"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">End point (optional)</Label>
              <Input
                value={endInput}
                onChange={(e) => applyEndInput(e.target.value)}
                placeholder="auto"
                className="bg-slate-950 border-slate-700"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-400">Per-song volume: {volume}%</Label>
            <input
              type="range" min={0} max={100} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          {suggestion && (
            <p className="text-xs text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 rounded p-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> {suggestion.reason} at {formatTime(suggestion.start)}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleSuggest} disabled={!peaks} className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800">
            <Wand2 className="w-4 h-4 mr-1" /> Auto-suggest
          </Button>
          <Button variant="outline" onClick={togglePreview} className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800">
            {previewing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {previewing ? 'Stop' : 'Preview'}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}