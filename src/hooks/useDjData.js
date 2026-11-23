import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getSelectedTeamId, getFreshPreviewToken, getTeamSongs, getTeamPlaylists, createPrivateAudioUrl } from '@/api/supabaseClient';

export const SONGS_KEY = ['songs'];
export const PLAYLISTS_KEY = ['playlists'];

// In-memory, read-only preview data; never fetch Base44 during this test.
let migrationAccessToken = null;
export const setMigrationToken = (token) => { migrationAccessToken = token; };
export const getMigrationToken = () => migrationAccessToken;
let migrationSongs = [];
let migrationPlaylists = [];
export function setMigrationData(songs, playlists) {
  migrationSongs = songs;
  migrationPlaylists = playlists;
}
export function setMigrationPlaylists(playlists) { migrationPlaylists = playlists; }
export const getMigrationSongs = () => migrationSongs;
export const getMigrationPlaylists = () => migrationPlaylists;
export function addMigrationSong(song) {
  migrationSongs = [song, ...migrationSongs.filter(s => s.id !== song.id)];
}
export function removeMigrationSong(id) {
  migrationSongs = migrationSongs.filter(song => song.id !== id);
  migrationPlaylists = migrationPlaylists.map(playlist => ({
    ...playlist, song_ids: (playlist.song_ids || []).filter(songId => songId !== id),
  }));
}
export function updateMigrationSong(updated) {
  migrationSongs = migrationSongs.map(song => song.id === updated.id ? { ...song, ...updated } : song);
}
const originalUiTest = () => import.meta.env.VITE_ICEDECK_STANDALONE === 'true' || (typeof window !== 'undefined' && window.location.pathname === '/supabase-original');
// Never refresh from the in-memory cache: changes made by another DJ or
// through the Supabase dashboard must be visible after pull-to-refresh.
async function refreshTeamSongs() {
  const team = getSelectedTeamId();
  if (!team) return migrationSongs;
  const token = await getFreshPreviewToken();
  const rows = await getTeamSongs(token, team);
  const songs = new Array(rows.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(8, rows.length) }, async () => {
    while (cursor < rows.length) {
      const index = cursor++;
      const song = rows[index];
      const audioUrlExpiresAt = Date.now() + 59 * 60_000;
      const file_url = song.storage_path
        ? await createPrivateAudioUrl(song.storage_path, await getFreshPreviewToken(), 3600)
        : '';
      songs[index] = { ...song, preview_url: '', file_url, audioUrlExpiresAt };
    }
  }));
  // A team switch may have happened during the network requests.
  if (getSelectedTeamId() === team) migrationSongs = songs;
  return songs;
}
async function refreshTeamPlaylists() {
  const team = getSelectedTeamId();
  if (!team) return migrationPlaylists;
  const playlists = await getTeamPlaylists(await getFreshPreviewToken(), team);
  if (getSelectedTeamId() === team) migrationPlaylists = playlists;
  return playlists;
}
export const fetchSongs = () => originalUiTest() ? refreshTeamSongs() : base44.entities.Song.list('-updated_date', 200);
export const fetchPlaylists = () => originalUiTest() ? refreshTeamPlaylists() : base44.entities.Playlist.list('-updated_date', 100);

export const songsQueryOptions = {
  queryKey: SONGS_KEY,
  queryFn: fetchSongs,
  staleTime: 60 * 1000,
};
export const playlistsQueryOptions = {
  queryKey: PLAYLISTS_KEY,
  queryFn: fetchPlaylists,
  staleTime: 60 * 1000,
};
export const useSongs = () => useQuery(songsQueryOptions);
export const usePlaylists = () => useQuery(playlistsQueryOptions);
