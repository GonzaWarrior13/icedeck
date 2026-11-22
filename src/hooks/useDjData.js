import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

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
export const fetchSongs = () => originalUiTest() ? Promise.resolve(migrationSongs) : base44.entities.Song.list('-updated_date', 200);
export const fetchPlaylists = () => originalUiTest() ? Promise.resolve(migrationPlaylists) : base44.entities.Playlist.list('-updated_date', 100);

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
