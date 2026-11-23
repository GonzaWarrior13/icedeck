import { getAccessToken } from './spotifyStandalone';

const storageKey = 'icedeck_personal_spotify_library';

export function spotifyTrackId(input) {
  const value = input.trim();
  const uri = value.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];
  const url = URL.canParse(value) ? new URL(value) : null;
  const match = url?.pathname.match(/^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})\/?$/i);
  if (url?.origin !== 'https://open.spotify.com' || !match) {
    throw new Error('Paste the Spotify share link for one track.');
  }
  return match[1];
}

export function readPersonalSpotifyTracks() {
  const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
  return Array.isArray(value) ? value : [];
}

export async function addPersonalSpotifyTrack(input) {
  const id = spotifyTrackId(input);
  const tracks = readPersonalSpotifyTracks();
  if (tracks.some(track => track.id === id)) return tracks;

  const response = await fetch('https://api.spotify.com/v1/tracks/' + id, {
    headers: { Authorization: 'Bearer ' + await getAccessToken(true) },
  });
  if (!response.ok) throw new Error('Spotify could not find this track (' + response.status + ').');
  const track = await response.json();
  return saveSpotifyPlaylistTracks([{...track, id}]);
}

function writeTracks(tracks) {
  localStorage.setItem(storageKey, JSON.stringify(tracks));
  window.dispatchEvent(new Event('icedeck:spotify-library'));
  return tracks;
}

export function saveSpotifyPlaylistTracks(selection) {
  const tracks = new Map(readPersonalSpotifyTracks().map(track => [track.id, track]));
  for (const track of selection) {
    if (!/^[A-Za-z0-9]{22}$/.test(track.id || '') || !track.name || tracks.has(track.id)) continue;
    tracks.set(track.id, {
      id: track.id,
      title: track.name,
      artist: (track.artists || []).map(artist => artist.name).join(', '),
      duration: (track.duration_ms || 0) / 1000,
    });
  }
  return writeTracks([...tracks.values()]);
}

export function updatePersonalSpotifyTrack(id, changes) {
  return writeTracks(readPersonalSpotifyTracks().map(track => track.id === id ? {...track, ...changes} : track));
}

export function removePersonalSpotifyTrack(id) {
  return writeTracks(readPersonalSpotifyTracks().filter(track => track.id !== id));
}

const collectionsKey = 'icedeck_personal_spotify_collections';

export function readSpotifyCollections() {
  try {
    const value = JSON.parse(localStorage.getItem(collectionsKey));
    if (Array.isArray(value?.queue) && Array.isArray(value?.setlists)) return value;
  } catch {}
  return {queue: [], setlists: []};
}

export function saveSpotifyCollections(collections) {
  localStorage.setItem(collectionsKey, JSON.stringify(collections));
  return collections;
}
