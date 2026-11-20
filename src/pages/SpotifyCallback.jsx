import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { completeSpotifyAuth } from '@/lib/spotify';

// Spotify sends the browser back here with a one-time code; the backend swaps it
// for a token, then the app returns to the library.
export default function SpotifyCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (params.get('error')) {
      setError('Spotify login was cancelled.');
      return;
    }
    if (!code) {
      setError('Spotify did not return a login code.');
      return;
    }
    completeSpotifyAuth(code, state)
      .then(() => window.location.replace('/'))
      .catch((e) => setError(e?.response?.data?.error || e?.message || 'Spotify login failed'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center space-y-3">
        {error ? (
          <>
            <p className="text-sm text-red-400">{error}</p>
            <Link to="/" className="inline-block text-sm text-primary underline">Back to the library</Link>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Connecting to Spotify…</p>
          </>
        )}
      </div>
    </div>
  );
}