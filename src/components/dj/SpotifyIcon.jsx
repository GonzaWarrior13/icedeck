import React from 'react';

// Simple Spotify logo glyph (brand mark) so we don't depend on lucide having one.
export default function Spotify({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.59 14.43a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.07-.5 9.71 1.11.3.18.4.57.22.85zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.98-1.17a.78.78 0 1 1-.45-1.49c3.64-1.1 8.15-.56 11.24 1.33.37.22.49.7.26 1.07zm.11-2.84C14.68 8.98 9.6 8.8 6.55 9.74a.93.93 0 1 1-.54-1.78c3.5-1.07 9.06-.86 12.6 1.28a.93.93 0 1 1-.96 1.6z" />
    </svg>
  );
}