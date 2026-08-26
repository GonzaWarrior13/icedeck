import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const t = body.track;
    if (!t || !t.itunes_id || !t.title) {
      return Response.json({ error: 'Invalid track data' }, { status: 400 });
    }
    const duration = Number.isFinite(t.duration) ? Math.max(0, Math.round(t.duration)) : null;
    const tags = Array.isArray(body.tags) ? body.tags.slice(0, 10).map((x) => String(x)) : [];

    const song = await base44.entities.Song.create({
      title: String(t.title).slice(0, 300),
      artist: String(t.artist || "").slice(0, 300),
      duration: duration,
      source: "itunes",
      spotify_id: String(t.itunes_id),
      preview_url: t.preview_url || "",
      start_point: 0,
      tags: tags
    });
    return Response.json({ song });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}