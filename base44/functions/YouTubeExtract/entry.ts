import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import ytdl from 'npm:@distube/ytdl-core@4.16.1';

const MAX_SECONDS = 720;

function friendlyError(err) {
  const m = String((err && err.message) || err || '');
  if (/private|age|login|sign in/i.test(m)) return 'This video is private, age-restricted, or requires login — try another link';
  if (/could not extract|no video|no format/i.test(m)) return 'YouTube could not find a playable stream for that link';
  if (/network|timeout|fetch|econn|dns/i.test(m)) return 'YouTube blocked the download — try again or use another link';
  return 'YouTube blocked the download — try again or use another link';
}

function bytesToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunk = 0x8000;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, len)));
  }
  return btoa(binary);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const url = String(body.url || '').trim();
    if (!url || !ytdl.validateURL(url)) {
      return Response.json({ error: 'Enter a valid YouTube link' }, { status: 400 });
    }

    let info;
    try {
      info = await ytdl.getBasicInfo(url);
    } catch (e) {
      return Response.json({ error: friendlyError(e) }, { status: 400 });
    }

    const details = info.videoDetails || {};
    const durationSeconds = Number(details.lengthSeconds) || 0;
    if (durationSeconds > MAX_SECONDS) {
      return Response.json({ error: 'Clip is longer than 12 minutes — use a shorter link' }, { status: 400 });
    }

    let format;
    try {
      format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    } catch (e) {
      return Response.json({ error: friendlyError(e) }, { status: 400 });
    }
    if (!format || !format.url) {
      return Response.json({ error: 'No downloadable audio stream found — try another link' }, { status: 400 });
    }

    let stream;
    try {
      stream = ytdl(url, { format });
    } catch (e) {
      return Response.json({ error: friendlyError(e) }, { status: 400 });
    }

    const parts = [];
    let total = 0;
    for await (const chunk of stream) {
      const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      parts.push(u8);
      total += u8.byteLength;
    }
    if (!total) {
      return Response.json({ error: 'YouTube returned no audio data — try another link' }, { status: 400 });
    }
    const combined = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { combined.set(p, off); off += p.byteLength; }

    const author = (details.author && (details.author.name || details.author)) || 'YouTube';
    return Response.json({
      title: String(details.title || 'YouTube track').slice(0, 300),
      artist: String(author).slice(0, 300),
      durationSeconds,
      mime: format.mimeType || 'audio/mp4',
      audioBase64: bytesToBase64(combined)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}