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
  const updated = readPersonalSpotifyTracks().filter(track => track.id !== id);
  updated.unshift({
    id,
    title: track.name,
    artist: track.artists.map(artist => artist.name).join(', '),
  });
  localStorage.setItem(storageKey, JSON.stringify(updated));
  return updated;
}

export function removePersonalSpotifyTrack(id) {
  const tracks = readPersonalSpotifyTracks().filter(track => track.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(tracks));
  return tracks;
}
