import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, UploadCloud } from 'lucide-react';
import { analyzeLoudness, referenceDb, volumeForDb } from '@/lib/audio';

export default function SongUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
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
        accept="audio/*,video/mp4,.mp3,.mp4,.m4a,.wav,.ogg"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );
}