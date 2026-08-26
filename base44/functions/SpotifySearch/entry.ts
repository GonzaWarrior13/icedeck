import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { spotifyGet } from "../../shared/spotify.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const query = (body.query || "").trim();
    if (!query) return Response.json({ error: 'Query is required' }, { status: 400 });
    if (query.length > 200) return Response.json({ error: 'Query too long' }, { status: 400 });
    const limit = Math.min(Math.max(parseInt(body.limit) || 20, 1), 30);

    const res = await spotifyGet(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
    if (!res.ok) {
      const t = await res.text();
      return Response.json({ error: `Spotify search failed (${res.status})`, detail: t.slice(0, 200) }, { status: 502 });
    }
    const data = await res.json();
    const items = (data.tracks?.items || []).map((t) => {
      const album = t.album || {};
      const img = (album.images || [])[0] || {};
      const smallest = (album.images || []).slice(-1)[0] || {};
      return {
        spotify_id: t.id,
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(", "),
        album: album.name || "",
        duration: Math.round((t.duration_ms || 0) / 1000),
        preview_url: t.preview_url || "",
        album_art: img.url || "",
        thumb: smallest.url || img.url || "",
        spotify_url: t.external_urls?.spotify || ""
      };
    });
    return Response.json({ results: items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}