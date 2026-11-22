import { base44 } from '@/api/base44Client';

const key = (title, artist) => `${String(title || '').toLowerCase().trim()}|${String(artist || '').toLowerCase().trim()}`;

// Adds imported tracklists to the library, skipping anything already there.
// Returns how many tracks were created.
export async function importTracks({ tracks = [], source, existingSongs = [], onImported, max = 200 }) {
  const known = new Set(existingSongs.map((s) => key(s.title, s.artist)));
  const seen = new Set();
  const rows = [];

  tracks.forEach((track) => {
    if (!track || !track.title) return;
    const trackKey = key(track.title, track.artist);
    if (known.has(trackKey) || seen.has(trackKey)) return;
    seen.add(trackKey);
    rows.push({
      title: String(track.title).slice(0, 200),
      artist: String(track.artist || '').slice(0, 200),
      duration: Math.round(Number(track.duration) || 0),
      source,
      start_point: 0,
      volume: 100,
      tags: [],
    });
  });

  if (!rows.length) return 0;
  const created = await base44.entities.Song.bulkCreate(rows.slice(0, max));
  const added = Array.isArray(created) ? created : [];
  onImported?.(added);
  return added.length;
}