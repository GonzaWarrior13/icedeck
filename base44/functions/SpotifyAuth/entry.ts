import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const SCOPES = ['streaming', 'user-read-email', 'user-read-private'];

async function getProfile(accessToken) {
  const r = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!r.ok) throw new Error('Spotify profile fetch failed');
  const d = await r.json();
  return {
    spotify_user_id: d.id || '',
    spotify_display_name: d.display_name || d.id || 'Spotify user',
    is_premium: d.product === 'premium'
  };
}

async function upsertToken(base44, user, data) {
  const existing = await base44.asServiceRole.entities.SpotifyToken.filter({ created_by_id: user.id });
  const rec = existing && existing[0];
  if (rec) {
    await base44.asServiceRole.entities.SpotifyToken.update(rec.id, data);
  } else {
    await base44.asServiceRole.entities.SpotifyToken.create({ ...data, created_by_id: user.id });
  }
}

async function tokenExchange(clientId, clientSecret, params) {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) {
    const t = await r.text();
    return { error: `Spotify token request failed (${r.status})`, detail: t.slice(0, 300) };
  }
  return { data: await r.json() };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'config';
    const clientId = secrets.get('SPOTIFY_CLIENT_ID');
    const clientSecret = secrets.get('SPOTIFY_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Spotify credentials not configured' }, { status: 500 });
    }

    if (action === 'config') {
      return Response.json({ client_id: clientId, scopes: SCOPES.join(' ') });
    }

    if (action === 'exchange') {
      const { code, code_verifier, redirect_uri, remember } = body;
      if (!code || !code_verifier || !redirect_uri) {
        return Response.json({ error: 'Missing code, code_verifier, or redirect_uri' }, { status: 400 });
      }
      const res = await tokenExchange(clientId, clientSecret, {
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        code_verifier
      });
      if (res.error) return Response.json(res, { status: 502 });
      const td = res.data;
      const profile = await getProfile(td.access_token);
      await upsertToken(base44, user, { refresh_token: td.refresh_token, ...profile });
      return Response.json({
        access_token: td.access_token,
        refresh_token: td.refresh_token,
        expires_in: td.expires_in || 3600,
        remembered: !!remember,
        ...profile
      });
    }

    if (action === 'refresh') {
      let refreshToken = body.refresh_token;
      if (!refreshToken) {
        const existing = await base44.asServiceRole.entities.SpotifyToken.filter({ created_by_id: user.id });
        const rec = existing && existing[0];
        if (!rec) return Response.json({ error: 'No stored Spotify session' }, { status: 404 });
        refreshToken = rec.refresh_token;
      }
      const res = await tokenExchange(clientId, clientSecret, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });
      if (res.error) return Response.json(res, { status: 502 });
      const td = res.data;
      const profile = await getProfile(td.access_token);
      const newRefresh = td.refresh_token || refreshToken;
      await upsertToken(base44, user, { refresh_token: newRefresh, ...profile });
      return Response.json({
        access_token: td.access_token,
        refresh_token: newRefresh,
        expires_in: td.expires_in || 3600,
        remembered: true,
        ...profile
      });
    }

    if (action === 'disconnect') {
      const existing = await base44.asServiceRole.entities.SpotifyToken.filter({ created_by_id: user.id });
      for (const rec of (existing || [])) {
        try { await base44.asServiceRole.entities.SpotifyToken.delete(rec.id); } catch (_) {}
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}