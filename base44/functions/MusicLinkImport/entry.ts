import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Reads a public playlist page and returns its tracklist. Metadata only: no audio
// is downloaded, so imported tracks can be planned but not played.
const MAX_TRACKS = 200;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const clean = (value, fallback = '') =>
  String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 200);

function isoToSeconds(value) {
  const match = String(value || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0);
}

// Apple ships the playlist twice: a JSON-LD block (names, no artists) and a
// richer serialized payload (name, artist, length per track).
function appleLdPlaylist(html) {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const playlist = list.find((item) => item && item['@type'] === 'MusicPlaylist');
    if (playlist) return playlist;
  }
  return null;
}

function parseAppleServerData(html) {
  const match = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return [];
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const hits = [];
  const stack = [data];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (current.artistName && current.title) {
      hits.push(current);
      continue;
    }
    for (const key in current) {
      const next = current[key];
      if (next && typeof next === 'object') stack.push(next);
    }
  }
  hits.sort((a, b) => (Number(a.trackNumber) || 0) - (Number(b.trackNumber) || 0));
  return hits.map((t) => ({
    title: clean(t.title),
    artist: clean(t.artistName),
    duration: Math.round((Number(t.duration) || 0) / 1000),
  }));
}

function parseApple(html) {
  const playlist = appleLdPlaylist(html);
  const name = clean(playlist && playlist.name, 'Apple Music playlist');
  let tracks = parseAppleServerData(html).filter((t) => t.title);
  if (!tracks.length && playlist) {
    tracks = (playlist.track || [])
      .map((t) => ({
        title: clean(t && t.name),
        artist: clean(t && t.byArtist && (t.byArtist.name || t.byArtist)),
        duration: isoToSeconds(t && t.duration),
      }))
      .filter((t) => t.title);
  }
  if (!tracks.length) return null;
  return { name, tracks };
}

function collectLockups(root) {
  const found = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (current.lockupViewModel) {
      found.push(current.lockupViewModel);
      continue;
    }
    for (const key in current) {
      const next = current[key];
      if (next && typeof next === 'object') stack.push(next);
    }
  }
  return found;
}

function parseYouTube(html) {
  const match = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!match) return null;
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const name = clean(data && data.metadata && data.metadata.playlistMetadataRenderer && data.metadata.playlistMetadataRenderer.title, 'YouTube playlist');
  const seen = new Set();
  const tracks = [];
  for (const lockup of collectLockups(data)) {
    const id = lockup && lockup.contentId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const meta = (lockup.metadata && lockup.metadata.lockupMetadataViewModel) || {};
    const rows = (meta.metadata && meta.metadata.contentMetadataViewModel && meta.metadata.contentMetadataViewModel.metadataRows) || [];
    const artist = clean(rows[0] && rows[0].metadataParts && rows[0].metadataParts[0] && rows[0].metadataParts[0].text && rows[0].metadataParts[0].text.content, 'YouTube');
    const title = clean(meta.title && meta.title.content);
    if (!title) continue;
    tracks.push({ title, artist, duration: 0, videoId: id });
  }
  return { name, tracks };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const service = String(body.service || '');
    const url = String(body.url || '').trim();
    if (!url) return Response.json({ error: 'Paste a playlist link first' }, { status: 400 });

    let target;
    try {
      target = new URL(url);
    } catch {
      return Response.json({ error: 'That does not look like a link' }, { status: 400 });
    }
    if (target.protocol !== 'https:') {
      return Response.json({ error: 'That does not look like a link' }, { status: 400 });
    }

    const host = target.hostname.replace(/^www\./, '');
    const isApple = service === 'apple' && host === 'music.apple.com';
    const isYouTube = service === 'youtube' && (host === 'youtube.com' || host === 'music.youtube.com' || host === 'm.youtube.com');
    if (!isApple && !isYouTube) {
      return Response.json({ error: 'Paste a link from that service' }, { status: 400 });
    }

    let response;
    try {
      response = await fetch(target.toString(), {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1' },
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      return Response.json({ error: 'That page could not be reached — try again' }, { status: 502 });
    }
    if (!response.ok) {
      return Response.json({ error: `The service returned ${response.status} for that link` }, { status: 400 });
    }

    const html = await response.text();
    const result = isApple ? parseApple(html) : parseYouTube(html);
    if (!result) {
      return Response.json({ error: 'That link is not a public playlist — open it and copy the share link' }, { status: 400 });
    }
    if (!result.tracks.length) {
      return Response.json({ error: 'No tracks were found on that playlist' }, { status: 400 });
    }

    return Response.json({
      name: result.name,
      service,
      total: result.tracks.length,
      tracks: result.tracks.slice(0, MAX_TRACKS),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}