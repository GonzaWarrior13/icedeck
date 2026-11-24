import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { base44 } from '@/api/base44Client';
import { createPrivateAudioUrl, getFreshPreviewToken, updateTeamSong } from '@/api/supabaseClient';
import {
  decodeAudioFile, computePeaks, suggestStartPoint, formatTime, parseTime,
} from '@/lib/audio';
import { Loader2, Play, Pause, Sparkles, Save, Wand2, Scissors } from 'lucide-react';

// The waveform canvas is the heaviest piece of the editor; it loads with the dialog.
const Waveform = lazy(() => import('./Waveform'));

export default function StartPointEditor({ song, onClose, onSave, useSupabase = false }) {
  const isMobile = useIsMobile();
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
  const [audioUrl, setAudioUrl] = useState('');
  const bufRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setAnalyzing(true);
        const needsUrl = useSupabase && song?.storage_path && (!song.file_url || !(song.audioUrlExpiresAt > Date.now()));
        const url = needsUrl ? await createPrivateAudioUrl(song.storage_path, await getFreshPreviewToken()) : song?.file_url;
        if (cancelled) return;
        if (!url) throw new Error('No audio file');
        setAudioUrl(url);
        const buf = await decodeAudioFile(url);
        if (cancelled) return;
        bufRef.current = buf;
        setPeaks(computePeaks(buf, 700));
        setDuration(buf.duration);
      } catch (e) {
        if (!cancelled) setError('Waveform unavailable. You can enter cue times manually.');
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
      if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
    };
  }, [song, useSupabase]);

  const stopPreview = () => {
    if (previewRef.current) { previewRef.current.pause(); }
    setPreviewing(false);
    setPreviewTime(0);
  };

  const togglePreview = () => {
    if (previewing) { stopPreview(); return; }
    if (!audioUrl) return;
    if (!previewRef.current) previewRef.current = new Audio();
    const a = previewRef.current;
    if (a.src !== audioUrl) a.src = audioUrl;
    a.currentTime = start;
    a.volume = (volume / 100);
    setPreviewing(true);
    a.play().catch(() => {
      if (previewRef.current !== a) return;
      stopPreview();
      setError('This audio file could not be played.');
    });
    a.onended = () => { setPreviewing(false); setPreviewTime(0); };
    a.ontimeupdate = () => {
      if (end !== null && a.currentTime >= end) stopPreview();
      else setPreviewTime(a.currentTime);
    };
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
    setError('');
    try {
      if (!Number.isFinite(start) || start < 0 || (end !== null && (!Number.isFinite(end) || end <= start)) || !Number.isFinite(volume) || volume < 0 || volume > 100) {
        throw new Error('Please enter a valid start point, an end point after the start, and volume between 0 and 100%.');
      }
      if (duration > 0 && (start >= duration || (end !== null && end > duration))) {
        throw new Error('Cue points must fit within the track duration.');
      }
      const changes = { start_point: start, end_point: end, volume };
      if (useSupabase) {
        const rows = await updateTeamSong(await getFreshPreviewToken(), song.id, changes);
        if (!Array.isArray(rows) || rows.length !== 1) throw new Error('No song was updated. Check team permissions.');
        onSave?.({ id: song.id, ...changes });
      } else {
        await base44.entities.Song.update(song.id, changes);
        onSave?.({ id: song.id, ...changes });
      }
    } catch (e) {
      setError('Save failed: ' + (e.message || 'error'));
    } finally {
      setSaving(false);
    }
  };

  const displayTime = previewing ? previewTime : start;

  return (
    <Dialog open={!!song} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-popover border-border text-popover-foreground max-w-2xl rounded-[14px]">
        <motion.div
          className="space-y-4"
          initial={isMobile ? { y: 28, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" aria-hidden="true" /> <span className="min-w-0 break-words pr-8">{song?.title}</span>
            </DialogTitle>
            <DialogDescription>Adjust the start and end points for playback.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 rounded-[8px] p-2">{error}</p>}

            <div className="rounded-xl bg-background/60 border border-border p-3">
              {analyzing ? (
                <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> Analyzing audio…
                </div>
              ) : (
                <Suspense fallback={<div className="h-[84px] rounded bg-secondary/40" />}>
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
                </Suspense>
              )}
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatTime(displayTime)}</span>
                <span className="tabular-nums">/ {formatTime(duration)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cue-start" className="text-xs text-muted-foreground">Start point (mm:ss or sec)</Label>
                <Input
                  id="cue-start"
                  value={startInput}
                  onChange={(e) => applyStartInput(e.target.value)}
                  className="min-h-11 bg-background border-border"
                />
              </div>
              <div>
                <Label htmlFor="cue-end" className="text-xs text-muted-foreground">End point (optional)</Label>
                <Input
                  id="cue-end"
                  value={endInput}
                  onChange={(e) => applyEndInput(e.target.value)}
                  placeholder="auto"
                  className="min-h-11 bg-background border-border"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Per-song volume: {volume}%</Label>
              <input
                type="range" min={0} max={100} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Per-song volume"
              />
            </div>

            {suggestion && (
              <p className="text-xs text-primary bg-primary/10 border border-primary/20 rounded p-2 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {suggestion.reason} at {formatTime(suggestion.start)}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleSuggest} disabled={!peaks} className="min-h-11 bg-transparent border-border text-foreground hover:bg-secondary">
              <Wand2 className="w-4 h-4 mr-1" aria-hidden="true" /> Auto-suggest
            </Button>
            <Button variant="outline" onClick={togglePreview} disabled={!audioUrl} className="min-h-11 bg-transparent border-border text-foreground hover:bg-secondary">
              {previewing ? <Pause className="w-4 h-4 mr-1" aria-hidden="true" /> : <Play className="w-4 h-4 mr-1" aria-hidden="true" />}
              {previewing ? 'Stop' : 'Preview'}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-h-10 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4 mr-1" aria-hidden="true" />} Save
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}