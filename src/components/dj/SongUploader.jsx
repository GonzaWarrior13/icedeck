import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { uploadTeamMp3, MAX_MP3_BYTES, getFreshPreviewToken } from '@/api/supabaseClient';
import { getMigrationToken } from '@/hooks/useDjData';
import { Loader2, UploadCloud } from 'lucide-react';
import { analyzeLoudness, referenceDb, volumeForDb } from '@/lib/audio';

export default function SongUploader({ onUploaded, useSupabase = false }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setError('');
    if (useSupabase) {
      try {
        const token = await getFreshPreviewToken();
        for (const file of list) {
          if (!/\.mp3$/i.test(file.name) || file.size > MAX_MP3_BYTES || !file.size) {
            throw new Error('MP3 files must be 50 MB or smaller (your Supabase plan may set a lower limit).');
          }
          setProgress(`Preparing ${file.name}…`);
          const localUrl = URL.createObjectURL(file);
          let duration = 0;
          let loudness = null;
          try {
            duration = await new Promise((resolve) => {
              const a = new Audio();
              const finish = (n) => { a.removeAttribute('src'); a.load(); resolve(n); };
              a.addEventListener('loadedmetadata', () => finish(Number.isFinite(a.duration) ? a.duration : 0), { once: true });
              a.addEventListener('error', () => finish(0), { once: true });
              a.src = localUrl;
            });
            if (file.size <= 20 * 1024 * 1024) {
              try { loudness = await analyzeLoudness(localUrl); } catch { /* optional */ }
            }
          } finally { URL.revokeObjectURL(localUrl); }
          setProgress(`Uploading ${file.name}…`);
          const created = await uploadTeamMp3(token, file, {
            duration,
            ...(Number.isFinite(loudness) ? { loudness_db: Math.round(loudness * 10) / 10 } : {}),
          });
          onUploaded?.(created);
        }
        setProgress('Upload successful');
      } catch (err) { setError(err.message || 'Upload failed'); }
      finally {
        setUploading(false);
        setProgress('');
        if (inputRef.current) inputRef.current.value = '';
      }
      return;
    }
    try {
      // The library's own levels decide where a new track sits, so it drops in matched.
      const refs = [];
      try {
        const existing = await base44.entities.Song.filter({ loudness_db: { $exists: true } });
        existing.forEach((s) => {
          if (typeof s.loudness_db === 'number') refs.push(s.loudness_db);
        });
      } catch {
        /* level the track on its own if the library cannot be read */
      }
      for (const file of list) {
        setProgress(`Uploading ${file.name}…`);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const dur = await new Promise((res) => {
          const a = new Audio(file_url);
          a.addEventListener('loadedmetadata', () => res(a.duration || 0), { once: true });
          a.addEventListener('error', () => res(0), { once: true });
        });
        setProgress(`Leveling ${file.name}…`);
        let loudness = null;
        try {
          loudness = await analyzeLoudness(file_url);
        } catch {
          loudness = null;
        }
        const volume = volumeForDb(loudness, referenceDb(refs));
        if (loudness != null) refs.push(loudness);
        const created = await base44.entities.Song.create({
          title: file.name.replace(/\.[^.]+$/, ''),
          artist: 'Unknown',
          duration: Math.round(dur),
          file_url,
          source: 'local',
          start_point: 0,
          volume,
          tags: [],
          ...(loudness != null ? { loudness_db: Math.round(loudness * 10) / 10 } : {}),
        });
        onUploaded?.(created);
      }
    } catch (e) {
      setProgress('Upload failed: ' + (e.message || 'error'));
    } finally {
      setUploading(false);
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1">
    <label className="flex items-center gap-1.5 min-h-9 px-2.5 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 transition cursor-pointer text-[13px] font-semibold md:min-h-10 md:gap-2 md:px-4 md:text-sm">
      <UploadCloud className="w-3.5 h-3.5 md:w-4 md:h-4" />
      <span className="max-w-[132px] truncate md:max-w-none">
        {uploading ? (
          progress
        ) : (
          <>
            <span className="md:hidden">Upload</span>
            <span className="hidden md:inline">Upload tracks</span>
          </>
        )}
      </span>
      {uploading && <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin ml-0.5" />}
      <input
        ref={inputRef}
        type="file"
        accept={useSupabase ? '.mp3,audio/mpeg' : 'audio/*,video/mp4,.mp3,.mp4,.m4a,.wav,.ogg'}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
    {error && <span role="alert" className="max-w-64 text-xs text-destructive">{error}</span>}
    </div>
  );
}