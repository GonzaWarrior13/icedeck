import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = 'playlist-read-private playlist-read-collaborative';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = secrets.get('SPOTIFY_CLIENT_ID');
    const clientSecret = secrets.get('SPOTIFY_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return Response.json({
        error: 'Spotify is not set up yet. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET on the dashboard Secrets page, then reconnect.'
      }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'url') {
      const redirectUri = String(body.redirectUri || '');
      if (!redirectUri) return Response.json({ error: 'redirectUri is required' }, { status: 400 });
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: SCOPES
      });
      return Response.json({ url: 'https://accounts.spotify.com/authorize?' + params.toString() });
    }

    const form = new URLSearchParams();
    if (action === 'token') {
      const code = String(body.code || '');
      const redirectUri = String(body.redirectUri || '');
      if (!code || !redirectUri) {
        return Response.json({ error: 'code and redirectUri are required' }, { status: 400 });
      }
      form.set('grant_type', 'authorization_code');
      form.set('code', code);
      form.set('redirect_uri', redirectUri);
    } else if (action === 'refresh') {
      const refreshToken = String(body.refreshToken || '');
      if (!refreshToken) return Response.json({ error: 'refreshToken is required' }, { status: 400 });
      form.set('grant_type', 'refresh_token');
      form.set('refresh_token', refreshToken);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret)
      },
      body: form.toString(),
      signal: AbortSignal.timeout(15000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json({
        error: data.error_description || data.error || 'Spotify rejected the request'
      }, { status: 400 });
    }

    return Response.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in: data.expires_in || 3600
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}