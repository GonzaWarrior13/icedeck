import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const VALID_TYPES = ['track', 'album', 'playlist'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const query = (body.query || "").trim();
    if (!query) return Response.json({ error: 'Query is required' }, { status: 400 });
    if (query.length > 200) return Response.json({ error: 'Query too long' }, { status: 400 });
    const type = VALID_TYPES.includes(body.type) ? body.type : 'track';
    const limit = Math.min(Math.max(parseInt(body.limit) || 20, 1), 50);

    const clientId = secrets.get("SPOTIFY_CLIENT_ID");
    const clientSecret = secrets.get("SPOTIFY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Spotify credentials not configured' }, { status: 500 });
    }

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: 'grant_type=client_credentials'
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return Response.json({ error: `Spotify auth failed (${tokenRes.status})`, detail: t.slice(0, 200) }, { status: 502 });
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`;
    const sRes = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
    if (!sRes.ok) {
      const t = await sRes.text();
      return Response.json({ error: `Spotify search failed (${sRes.status})`, detail: t.slice(0, 200) }, { status: 502 });
    }
    const sData = await sRes.json();

    let items = [];
    if (type === 'track') {
      items = (sData.tracks?.items || []).map((t) => ({
        spotify_id: t.id,
        type: 'track',
        title: t.name || "",
        artist: (t.artists || []).map((a) => a.name).join(", "),
        album: t.album?.name || "",
        album_art: t.album?.images?.[0]?.url || "",
        duration: Math.round((t.duration_ms || 0) / 1000),
        preview_url: t.preview_url || "",
        spotify_uri: t.uri || "",
        spotify_url: t.external_urls?.spotify || ""
      }));
    } else if (type === 'album') {
      items = (sData.albums?.items || []).map((a) => ({
        spotify_id: a.id,
        type: 'album',
        title: a.name || "",
        artist: (a.artists || []).map((x) => x.name).join(", "),
        album_art: a.images?.[0]?.url || "",
        track_count: a.total_tracks || 0,
        spotify_uri: a.uri || "",
        spotify_url: a.external_urls?.spotify || ""
      }));
    } else {
      items = (sData.playlists?.items || []).map((p) => ({
        spotify_id: p.id,
        type: 'playlist',
        title: p.name || "",
        artist: p.owner?.display_name || "",
        album_art: p.images?.[0]?.url || "",
        track_count: p.tracks?.total || 0,
        spotify_uri: p.uri || "",
        spotify_url: p.external_urls?.spotify || ""
      }));
    }
    return Response.json({ results: items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}