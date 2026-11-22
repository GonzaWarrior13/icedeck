import { base44 } from '@/api/base44Client';

// Spotify tokens live on this device only: the login code is exchanged for a
// token by the backend function so the client secret never reaches the browser.
const TOKEN_KEY = 'dj_spotify_tokens';
const STATE_KEY = 'dj_spotify_state';
const API = 'https://api.spotify.com/v1';

export const spotifyRedirectUri = () => `${window.location.origin}/spotify-callback`;

export function getSpotifyTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  } catch {
    return null;
  }
}

export function isSpotifyConnected() {
  const tokens = getSpotifyTokens();
  return !!(tokens && tokens.refresh_token);
}

export function disconnectSpotify() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function startSpotifyAuth() {
  const res = await base44.functions.invoke('spotifyAuth', {
    action: 'url',
    redirectUri: spotifyRedirectUri(),
  });
  const url = res.data?.url;
  if (!url) throw new Error(res.data?.error || 'Could not start the Spotify login');
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  window.location.href = `${url}&state=${encodeURIComponent(state)}`;
}

export async function completeSpotifyAuth(code, state) {
  const expected = sessionStorage.getItem(STATE_KEY);
  if (expected && state && state !== expected) {
    throw new Error('That Spotify login could not be verified — try again');
  }
  sessionStorage.removeItem(STATE_KEY);
  const res = await base44.functions.invoke('spotifyAuth', {
    action: 'token',
    code,
    redirectUri: spotifyRedirectUri(),
  });
  const d = res.data || {};
  if (!d.access_token) throw new Error(d.error || 'Spotify login failed');
  localStorage.setItem(TOKEN_KEY, JSON.stringify({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + ((d.expires_in || 3600) - 60) * 1000,
    scope: d.scope || '',
  }));
}

// Full-song playback needs the streaming scope, which older logins did not request.
export function hasSpotifyStreaming() {
  const tokens = getSpotifyTokens();
  return !!(tokens && typeof tokens.scope === 'string' && tokens.scope.split(' ').includes('streaming'));
}

async function refreshTokens(tokens) {
  const res = await base44.functions.invoke('spotifyAuth', {
    action: 'refresh',
    refreshToken: tokens.refresh_token,
  });
  const d = res.data || {};
  if (!d.access_token) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error(d.error || 'Spotify session expired — reconnect your account');
  }
  const next = {
    access_token: d.access_token,
    refresh_token: d.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + ((d.expires_in || 3600) - 60) * 1000,
    scope: d.scope || tokens.scope || '',
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
  return next;
}

export async function getValidAccessToken() {
  let tokens = getSpotifyTokens();
  if (!tokens || !tokens.refresh_token) throw new Error('Connect Spotify first');
  if (Date.now() >= (tokens.expires_at || 0)) tokens = await refreshTokens(tokens);
  return tokens.access_token;
}

export async function spotifyFetch(path, options = {}) {
  let tokens = getSpotifyTokens();
  if (!tokens || !tokens.refresh_token) throw new Error('Connect Spotify first');
  if (Date.now() >= (tokens.expires_at || 0)) tokens = await refreshTokens(tokens);

  const call = (token) => fetch(API + path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  let res = await call(tokens.access_token);
  if (res.status === 401) {
    tokens = await refreshTokens(tokens);
    res = await call(tokens.access_token);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Spotify error ${res.status}`);
  return data;
}

export function spotifyRequest(method, path, body) {
  return spotifyFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const nextPath = (page) => (page.next ? page.next.replace(API, '') : null);

export async function fetchSpotifyPlaylists() {
  const playlists = [];
  let path = '/me/playlists?limit=50';
  while (path && playlists.length < 200) {
    const page = await spotifyFetch(path);
    (page.items || []).forEach((pl) => { if (pl) playlists.push(pl); });
    path = nextPath(page);
  }
  return playlists;
}

export async function fetchSpotifyPlaylistTracks(playlistId) {
  const tracks = [];
  let path = `/playlists/${playlistId}/tracks?limit=100`;
  while (path && tracks.length < 500) {
    const page = await spotifyFetch(path);
    (page.items || []).forEach((item) => { if (item && item.track) tracks.push(item.track); });
    path = nextPath(page);
  }
  return tracks;
}