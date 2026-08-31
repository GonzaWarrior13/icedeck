import { base44 } from '@/api/base44Client';

const PKCE_KEY = 'icedeck_spotify_pkce';

function randomString(len) {
  const arr = new Uint8Array(len);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let out = '';
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out;
}

async function sha256Base64Url(plain) {
  const data = new TextEncoder().encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  let str = '';
  const bytes = new Uint8Array(hash);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let REDIRECT_BASE = 'https://icedeck-arena-audio.base44.app';

export function setRedirectBase(url) {
  REDIRECT_BASE = (url || '').replace(/\/$/, '');
}

export function redirectUri() {
  return window.location.origin + '/spotify-callback';
}

export async function startAuth(remember) {
  const res = await base44.functions.invoke('SpotifyAuth', { action: 'config' });
  const { client_id, scopes } = res.data;
  const code_verifier = randomString(64);
  const code_challenge = await sha256Base64Url(code_verifier);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ code_verifier, remember: !!remember }));
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', code_challenge);
  url.searchParams.set('scope', scopes);
  window.location.href = url.toString();
}

export function waitForAuthCode() {
  return new Promise((resolve) => {
    const expectedOrigin = new URL(REDIRECT_BASE).origin;
    function onMsg(e) {
      if (e.origin !== expectedOrigin) return;
      if (e.data && e.data.type === 'icedeck_spotify_code') {
        window.removeEventListener('message', onMsg);
        resolve(e.data.code);
      }
    }
    window.addEventListener('message', onMsg);
  });
}

export async function exchangeCode(code) {
  const stored = JSON.parse(sessionStorage.getItem(PKCE_KEY) || '{}');
  sessionStorage.removeItem(PKCE_KEY);
  const res = await base44.functions.invoke('SpotifyAuth', {
    action: 'exchange',
    code,
    code_verifier: stored.code_verifier,
    redirect_uri: redirectUri(),
    remember: !!stored.remember
  });
  return res.data;
}

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const stored = JSON.parse(sessionStorage.getItem(PKCE_KEY) || '{}');
  sessionStorage.removeItem(PKCE_KEY);
  if (!code) throw new Error('Spotify did not return an authorization code');
  const res = await base44.functions.invoke('SpotifyAuth', {
    action: 'exchange',
    code,
    code_verifier: stored.code_verifier,
    redirect_uri: redirectUri(),
    remember: !!stored.remember
  });
  return res.data;
}

export async function refreshWith(refresh_token) {
  const res = await base44.functions.invoke('SpotifyAuth', { action: 'refresh', refresh_token, redirect_uri: redirectUri() });
  return res.data;
}

export async function restoreSession() {
  const res = await base44.functions.invoke('SpotifyAuth', { action: 'refresh', redirect_uri: redirectUri() });
  return res.data;
}

export async function disconnectSession() {
  const res = await base44.functions.invoke('SpotifyAuth', { action: 'disconnect' });
  return res.data;
}