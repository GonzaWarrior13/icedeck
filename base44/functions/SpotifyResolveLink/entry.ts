import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Pull the embedded Next.js __NEXT_DATA__ JSON from the Spotify embed page.
function extractNextData(html) {
  const startMarker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(startMarker);
  if (start === -1) return null;
  const jsonStart = start + startMarker.length;
  const end = html.indexOf('</script>', jsonStart);
  if (end === -1) return null;
  try { return JSON.parse(html.slice(jsonStart, end)); } catch (_) { return null; }
}

function scrapeTrackFromEmbed(html) {
  const next = extractNextData(html);
  const entity = next?.props?.pageProps?.state?.data?.entity;
  if (!entity || typeof entity !== 'object') return null;
  const artists = Array.isArray(entity.artists) ? entity.artists.map((a) => a && a.name).filter(Boolean) : [];
  const durationMs = Number(entity.duration);
  const preview = entity.audioPreview?.url || '';
  const albumArt = (Array.isArray(entity.images) && entity.images[0] && entity.images[0].url) || '';
  return {
    name: entity.name || entity.title || '',
    artist: artists.join(', '),
    duration: Number.isFinite(durationMs) ? Math.round(durationMs / 1000) : null,
    preview_url: preview,
    album_art: albumArt
  };
}

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

    const item = {
      type,
      spotify_id,
      title: meta.title || '',
      artist: '',
      duration: null,
      preview_url: '',
      album_art: meta.thumbnail_url || '',
      spotify_url: canonical
    };

    // Enrich tracks with artist, duration, and a 30s preview URL from the embed page (no Web API needed).
    if (type === 'track') {
      try {
        const embedRes = await fetch(`https://open.spotify.com/embed/track/${spotify_id}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        if (embedRes.ok) {
          const html = await embedRes.text();
          const scraped = scrapeTrackFromEmbed(html);
          if (scraped) {
            if (scraped.artist) item.artist = scraped.artist;
            if (scraped.duration !== null && scraped.duration !== undefined) item.duration = scraped.duration;
            if (scraped.preview_url) item.preview_url = scraped.preview_url;
            if (!item.title && scraped.name) item.title = scraped.name;
            if (!item.album_art && scraped.album_art) item.album_art = scraped.album_art;
          }
        }
      } catch (_) {}
    }

    return Response.json(item);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}