// Standalone Spotify Web API integration. No Base44 calls or client secret.
// Uses OAuth 2.0 Authorization Code + PKCE (Spotify's 2026 browser flow).
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const PENDING_KEY = 'icedeck_spotify_pkce';
const TOKEN_KEY = 'icedeck_spotify_session';
export const spotifyConfigured = Boolean(CLIENT_ID);
export const spotifyCallbackUrl = () => window.location.origin + '/spotify-callback';

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; }
}
function storeSession(tokens, previous = null) {
  const next = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || previous?.refresh_token,
    expires_at: Date.now() + Math.max(30, (tokens.expires_in || 3600) - 60) * 1000,
  };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(next));
  return next;
}
export function spotifyConnected() { return !!getSession()?.refresh_token; }
export function disconnectSpotifyStandalone() { sessionStorage.removeItem(TOKEN_KEY); }

export async function startSpotifyStandaloneAuth() {
  if (!CLIENT_ID) throw new Error('Set VITE_SPOTIFY_CLIENT_ID in the IceDeck environment first.');
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(48)), byte => byte.toString(16).padStart(2,'0')).join('');
  const challengeData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeData)))
    .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const state = crypto.randomUUID();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    response_type:'code',
    client_id:CLIENT_ID,
    redirect_uri:spotifyCallbackUrl(),
    state,
    scope:'playlist-read-private playlist-read-collaborative',
    code_challenge_method:'S256',
    code_challenge:challenge,
  }).toString();
  window.location.assign(url.toString());
}
export async function completeSpotifyStandaloneAuth() {
  if (window.location.pathname !== '/spotify-callback') return false;
  const params = new URLSearchParams(window.location.search);
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
  sessionStorage.removeItem(PENDING_KEY);
  if (!pending || !params.get('state') || params.get('state') !== pending.state)
    throw new Error('Spotify connection could not be verified. Please try again.');
  if (params.get('error')) throw new Error('Spotify authorization was cancelled: ' + params.get('error'));
  if (!params.get('code')) throw new Error('Spotify did not return an authorization code.');
  const result = await fetch(TOKEN_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:new URLSearchParams({
      grant_type:'authorization_code',
      code:params.get('code'),
      redirect_uri:spotifyCallbackUrl(),
      client_id:CLIENT_ID,
      code_verifier:pending.verifier,
    }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Spotify login failed');
  storeSession(data);
  window.history.replaceState({}, '', '/');
  return true;
}
async function getAccessToken() {
  let tokens = getSession();
  if (!tokens?.refresh_token) throw new Error('Connect Spotify first.');
  if (Date.now() < tokens.expires_at) return tokens.access_token;
  const response = await fetch(TOKEN_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:new URLSearchParams({
      grant_type:'refresh_token',
      refresh_token:tokens.refresh_token,
      client_id:CLIENT_ID,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    disconnectSpotifyStandalone();
    throw new Error(data.error_description || data.error || 'Spotify session expired. Reconnect your account.');
  }
  tokens = storeSession(data,tokens);
  return tokens.access_token;
}
async function spotifyRequest(path) {
  const response = await fetch(API_URL + path, {
    headers:{ Authorization:'Bearer ' + await getAccessToken() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Spotify API error ' + response.status);
  return data;
}
export async function getSpotifyPlaylistsStandalone() {
  const result = [];
  let path = '/me/playlists?limit=50';
  while (path && result.length < 200) {
    const page = await spotifyRequest(path);
    result.push(...(page.items || []).filter(Boolean));
    path = page.next ? new URL(page.next).pathname.replace('/v1','') + new URL(page.next).search : null;
  }
  return result.slice(0,200);
}
export async function getSpotifyPlaylistItemsStandalone(id) {
  if (!/^[a-zA-Z0-9]+$/.test(id)) throw new Error('Invalid playlist identifier.');
  const result = [];
  let path = '/playlists/' + id + '/items?limit=50';
  while (path && result.length < 500) {
    const page = await spotifyRequest(path);
    result.push(...(page.items || []).map(item => item?.item || item?.track).filter(Boolean));
    path = page.next ? new URL(page.next).pathname.replace('/v1','') + new URL(page.next).search : null;
  }
  return result.slice(0,500);
}
