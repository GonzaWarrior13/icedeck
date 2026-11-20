import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const query = (body.query || "").trim();
    if (!query) return Response.json({ error: 'Query is required' }, { status: 400 });
    if (query.length > 200) return Response.json({ error: 'Query too long' }, { status: 400 });
    const limit = Math.min(Math.max(parseInt(body.limit) || 25, 1), 50);

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Rinkbeats/1.0" }
    });
    if (!res.ok) {
      const t = await res.text();
      return Response.json({ error: `iTunes search failed (${res.status})`, detail: t.slice(0, 200) }, { status: 502 });
    }
    const data = await res.json();
    const items = (data.results || []).map((t) => ({
      itunes_id: String(t.trackId),
      title: t.trackName || "",
      artist: t.artistName || "",
      album: t.collectionName || "",
      album_art: t.artworkUrl100 || t.artworkUrl60 || "",
      duration: Math.round((t.trackTimeMillis || 0) / 1000),
      preview_url: t.previewUrl || "",
      itunes_url: t.trackViewUrl || "",
      genre: t.primaryGenreName || ""
    }));
    return Response.json({ results: items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}