import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, UploadCloud } from 'lucide-react';

export default function SongUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        setProgress(`Uploading ${file.name}…`);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const dur = await new Promise((res) => {
          const a = new Audio(file_url);
          a.addEventListener('loadedmetadata', () => res(a.duration || 0), { once: true });
          a.addEventListener('error', () => res(0), { once: true });
        });
        const created = await base44.entities.Song.create({
          title: file.name.replace(/\.[^.]+$/, ''),
          artist: 'Unknown',
          duration: Math.round(dur),
          file_url,
          source: 'local',
          start_point: 0,
          volume: 100,
          tags: [],
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
    <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-400/20 transition cursor-pointer text-sm font-medium">
      <UploadCloud className="w-4 h-4" />
      <span>{uploading ? progress : 'Upload tracks'}</span>
      {uploading && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
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