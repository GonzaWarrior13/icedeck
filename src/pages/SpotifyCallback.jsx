import React, { useEffect, useState } from 'react';
import { exchangeCode } from '@/lib/spotifyAuth';
import { Loader2, AlertCircle } from 'lucide-react';

export default function SpotifyCallback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const err = params.get('error');

    let done = false;
    (async () => {
      try {
        if (err) throw new Error(err);
        if (!code) throw new Error('Spotify did not return an authorization code');
        await exchangeCode(code);
        if (done) return;
        window.location.href = '/';
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