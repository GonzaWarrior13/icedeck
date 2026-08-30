import React, { useState, useRef, useEffect } from 'react';
import { useDj } from '@/lib/DjContext';
import Spotify from '@/components/dj/SpotifyIcon';

export default function SpotifyConnectButton() {
  const dj = useDj();
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(true);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (dj.spotifyConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 max-w-[140px]">
          <Spotify className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{dj.spotifyDisplayName || 'Connected'}</span>
          {!dj.spotifyPremium && <span className="text-amber-400" title="Premium required for full playback">·free</span>}
        </span>
        <button
          onClick={dj.disconnectSpotify}
          className="text-xs text-slate-500 hover:text-rose-300 px-2 py-1 rounded hover:bg-slate-800"
          title="Disconnect Spotify"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
        title="Connect Spotify for full-track playback"
      >
        <Spotify className="w-3.5 h-3.5" /> Connect
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-60 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl z-30">
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            Sign in with a <span className="text-emerald-400 font-medium">Spotify Premium</span> account to hear full tracks.
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-300 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-emerald-400"
            />
            Remember me on this device
          </label>
          <button
            onClick={() => dj.connectSpotify(remember)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            <Spotify className="w-4 h-4" /> Continue to Spotify
          </button>
        </div>
      )}
    </div>
  );
}