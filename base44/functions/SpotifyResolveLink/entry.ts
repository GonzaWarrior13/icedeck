import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const url = (body.url || "").trim();
    if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });
    if (url.length > 500) return Response.json({ error: 'URL too long' }, { status: 400 });

    const m = url.match(/spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]+)/) ||
              url.match(/^spotify:(track|album|playlist):([A-Za-z0-9]+)/);
    if (!m) return Response.json({ error: 'Not a valid Spotify track, album, or playlist link' }, { status: 400 });
    const type = m[1];
    const spotify_id = m[2];

    const canonical = `https://open.spotify.com/${type}/${spotify_id}`;
    let meta = {};
    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(canonical)}`, {
        headers: { "User-Agent": "IceDeckDJ/1.0" }
      });
      if (res.ok) meta = await res.json().catch(() => ({}));
    } catch (_) {}

    return Response.json({
      type,
      spotify_id,
      title: meta.title || '',
      album_art: meta.thumbnail_url || '',
      spotify_url: canonical
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}