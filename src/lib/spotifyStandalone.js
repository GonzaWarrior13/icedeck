// Standalone Spotify Web API integration. No Base44 calls or client secret.
// Uses OAuth 2.0 Authorization Code + PKCE (Spotify's 2026 browser flow).
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const PENDING_KEY = 'icedeck_spotify_pkce';
const TOKEN_KEY = 'icedeck_spotify_session';
export const spotifyConfigured = Boolean(CLIENT_ID);
export const PERSONAL_SPOTIFY_LIBRARY = '/?spotify=1';
const hostedSpotifyOrigin = import.meta.env.VITE_ICEDECK_SPOTIFY_ORIGIN;
const currentOrigin = window.location.origin;
export const personalSpotifyEnabled = spotifyConfigured
  && import.meta.env.VITE_ICEDECK_STANDALONE === 'true'
  && ((import.meta.env.DEV && currentOrigin === 'http://127.0.0.1:5173')
    || (hostedSpotifyOrigin?.startsWith('https://') && currentOrigin === hostedSpotifyOrigin));
const PERSONAL_PENDING_KEY = PENDING_KEY + '_personal';
const PERSONAL_TOKEN_KEY = TOKEN_KEY + '_personal';
export const hasPendingPersonalSpotify = () => Boolean(sessionStorage.getItem(PERSONAL_PENDING_KEY));
export const spotifyCallbackUrl = () => window.location.origin + '/spotify-callback';

function getSession(personal = false) {
  try { return JSON.parse(sessionStorage.getItem(personal ? PERSONAL_TOKEN_KEY : TOKEN_KEY) || 'null'); } catch { return null; }
}
function storeSession(tokens, previous = null, personal = false) {
  const next = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || previous?.refresh_token,
    expires_at: Date.now() + Math.max(30, (tokens.expires_in || 3600) - 60) * 1000,
  };
  sessionStorage.setItem(personal ? PERSONAL_TOKEN_KEY : TOKEN_KEY, JSON.stringify(next));
  return next;
}
export function spotifyConnected(personal = false) { return !!getSession(personal)?.refresh_token; }
export function disconnectSpotifyStandalone(personal = false) { sessionStorage.removeItem(personal ? PERSONAL_TOKEN_KEY : TOKEN_KEY); }

export async function startSpotifyStandaloneAuth(personal = false) {
  if (personal && !personalSpotifyEnabled) throw new Error('Personal Spotify playback is unavailable on this IceDeck address.');
  if (!CLIENT_ID) throw new Error('Set VITE_SPOTIFY_CLIENT_ID in the IceDeck environment first.');
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(48)), byte => byte.toString(16).padStart(2,'0')).join('');
  const challengeData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeData)))
    .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const state = crypto.randomUUID();
  sessionStorage.setItem(personal ? PERSONAL_PENDING_KEY : PENDING_KEY, JSON.stringify({ verifier, state }));
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    response_type:'code',
    client_id:CLIENT_ID,
    redirect_uri:spotifyCallbackUrl(),
    state,
    scope: personal ? 'streaming user-read-email user-read-private user-modify-playback-state' : 'playlist-read-private playlist-read-collaborative',
    code_challenge_method:'S256',
    code_challenge:challenge,
  }).toString();
  window.location.assign(url.toString());
}
export async function completeSpotifyStandaloneAuth(personal = false) {
  if (window.location.pathname !== '/spotify-callback') return false;
  const params = new URLSearchParams(window.location.search);
  const pendingKey = personal ? PERSONAL_PENDING_KEY : PENDING_KEY;
  const pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
  sessionStorage.removeItem(pendingKey);
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
  storeSession(data, null, personal);
  window.history.replaceState({}, '', personal ? PERSONAL_SPOTIFY_LIBRARY : '/');
  return true;
}
export async function getAccessToken(personal = false) {
  let tokens = getSession(personal);
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
    disconnectSpotifyStandalone(personal);
    throw new Error(data.error_description || data.error || 'Spotify session expired. Reconnect your account.');
  }
  tokens = storeSession(data, tokens, personal);
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
