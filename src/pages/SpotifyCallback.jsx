import React, { useEffect, useState } from 'react';
import { useDj } from '@/lib/DjContext';
import { handleCallback } from '@/lib/spotifyAuth';
import { Loader2, AlertCircle } from 'lucide-react';

export default function SpotifyCallback() {
  const dj = useDj();
  const [error, setError] = useState(null);

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        const data = await handleCallback();
        if (done) return;
        dj.applySpotifySession(data);
        const next = sessionStorage.getItem('icedeck_spotify_return') || '/';
        sessionStorage.removeItem('icedeck_spotify_return');
        window.location.href = next;
      } catch (e) {
        if (done) return;
        setError(e.message || 'Spotify connection failed');
      }
    })();
    return () => { done = true; };
  }, []);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-300">
      {error ? (
        <>
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <p className="text-sm">{error}</p>
          <a href="/" className="text-xs text-cyan-300 hover:underline">Back to library</a>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm">Connecting to Spotify…</p>
        </>
      )}
    </div>
  );
}