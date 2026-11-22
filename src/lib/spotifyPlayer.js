import { getValidAccessToken, spotifyRequest } from './spotify';

// Spotify Web Playback SDK: turns this browser into a Spotify device so Premium
// accounts can play full tracks. DRM audio is decoded by Spotify, so the console's
// waveform tools only apply to files uploaded to the library.
const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

let sdkPromise = null;
let playerPromise = null;
let player = null;
let deviceId = null;

function loadSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Spotify playback needs a browser'));
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error('The Spotify player could not load'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export function getSpotifyDeviceId() {
  return deviceId;
}

export async function getSpotifyPlayer() {
  if (playerPromise) return playerPromise;
  playerPromise = (async () => {
    const Spotify = await loadSdk();
    const instance = new Spotify.Player({
      name: 'Rinkbeats Console',
      volume: 1,
      getOAuthToken: (cb) => {
        getValidAccessToken().then(cb).catch(() => cb(''));
      },
    });

    await new Promise((resolve, reject) => {
      instance.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        resolve();
      });
      instance.addListener('not_ready', () => {
        deviceId = null;
      });
      instance.addListener('initialization_error', ({ message }) => reject(new Error(message || 'The Spotify player could not start')));
      instance.addListener('authentication_error', () => reject(new Error('Spotify login expired — reconnect your account')));
      instance.addListener('account_error', () => reject(new Error('Spotify Premium is required for full songs')));
      instance.connect();
    });

    player = instance;
    return instance;
  })().catch((error) => {
    playerPromise = null;
    throw error;
  });
  return playerPromise;
}

export async function playSpotifyTrack(uri, positionMs = 0) {
  await getSpotifyPlayer();
  if (!deviceId) throw new Error('The Spotify player is not ready yet');
  await spotifyRequest('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    uris: [uri],
    position_ms: Math.max(0, Math.round(positionMs)),
  });
}

export async function resumeSpotify() {
  const instance = await getSpotifyPlayer();
  await instance.resume();
}

export async function pauseSpotify() {
  if (!player) return;
  await player.pause();
}

export function seekSpotify(positionMs) {
  if (player) player.seek(Math.max(0, Math.round(positionMs)));
}

export function setSpotifyVolume(volume) {
  if (player) player.setVolume(Math.min(1, Math.max(0, volume)));
}

export async function getSpotifyState() {
  if (!player) return null;
  try {
    return await player.getCurrentState();
  } catch {
    return null;
  }
}