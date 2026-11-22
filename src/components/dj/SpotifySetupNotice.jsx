import React, { useState } from 'react';
import { Music, X } from 'lucide-react';

// The legacy Spotify OAuth flow uses a Base44 server function. Do not launch
// that flow from the independent Supabase deployment.
export default function SpotifySetupNotice() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 min-h-9 rounded-[10px] border border-border px-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:min-h-10 md:px-3.5 md:text-sm"
      >
        <Music className="w-4 h-4" aria-hidden="true" /> Connect Spotify
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-30 rounded-[10px] border border-border bg-popover shadow-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <strong className="text-sm">Spotify connection</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Spotify status">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Spotify is not connected in this standalone version yet. The previous login
            depended on Base44. We need to configure independent Spotify OAuth before
            this button can connect an account.
          </p>
          <p className="text-xs text-muted-foreground">
            Spotify streaming and full-track playback also require a separately approved
            integration; importing track names alone does not enable playback.
          </p>
        </div>
      )}
    </div>
  );
}
