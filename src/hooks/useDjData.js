import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const SONGS_KEY = ['songs'];
export const PLAYLISTS_KEY = ['playlists'];

// In-memory, read-only preview data; never fetch Base44 during this test.
let migrationSongs = [];
let migrationPlaylists = [];
export function setMigrationData(songs, playlists) {
  migrationSongs = songs;
  migrationPlaylists = playlists;
}
export const setMigrationToken = () => {}; // compatibility with the test login
const originalUiTest = () => typeof window !== 'undefined' && window.location.pathname === '/supabase-original';
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
