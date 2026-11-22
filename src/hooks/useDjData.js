import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getTeamSongs, getTeamPlaylists } from '@/api/supabaseClient';

let migrationToken = null;
export const setMigrationToken = (token) => { migrationToken = token; };
const originalUiTest = () => typeof window !== 'undefined' && window.location.pathname === '/supabase-original';

export const SONGS_KEY = ['songs'];
export const PLAYLISTS_KEY = ['playlists'];

let previewSongs = [];
let previewPlaylists = [];
export function setSupabasePreviewData(songs, playlists) { previewSongs = songs; previewPlaylists = playlists; }
const isOriginalPreview = () => typeof window !== 'undefined' && window.location.pathname === '/supabase-original';
export const fetchSongs = () => isOriginalPreview() ? Promise.resolve(previewSongs) : base44.entities.Song.list('-updated_date', 200);
export const fetchPlaylists = () => isOriginalPreview() ? Promise.resolve(previewPlaylists) : base44.entities.Playlist.list('-updated_date', 100);

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

// One cache for the whole app: the library page, the setlists page, the player and
// the global hotkeys all read the same Song/Playlist queries.
export const useSongs = () => useQuery(songsQueryOptions);
export const usePlaylists = () => useQuery(playlistsQueryOptions);