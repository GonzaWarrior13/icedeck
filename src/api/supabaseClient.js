// Migration-only Supabase client. No service-role keys in browser code.
const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const isSupabaseConfigured = Boolean(url && key);
export const AUDIO_BUCKET = 'icedeck-audio';
export const TEAM_ID = import.meta.env.VITE_SUPABASE_TEAM_ID || '';

function headers(token, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${token || key}`, ...extra };
}
async function request(path, token, options = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase configuration missing');
  const response = await fetch(`${url}${path}`, {
    ...options, headers: headers(token, options.headers),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error_description || `Supabase HTTP ${response.status}`);
  return data;
}
export async function signIn(email, password) {
  return request('/auth/v1/token?grant_type=password', null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}
export async function refreshSession(refreshToken) {
  return request('/auth/v1/token?grant_type=refresh_token', null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
export async function getTeamSongs(accessToken, teamId = TEAM_ID) {
  if (!teamId) throw new Error('Team ID not configured');
  const query = new URLSearchParams({ select: '*', team_id: `eq.${teamId}`, scope: 'eq.team', order: 'updated_at.desc' });
  return request(`/rest/v1/songs?${query}`, accessToken);
}
export async function getTeamPlaylists(accessToken, teamId = TEAM_ID) {
  if (!teamId) throw new Error('Team ID not configured');
  const query = new URLSearchParams({ select: '*,playlist_items(song_id,position)', team_id: `eq.${teamId}`, scope: 'eq.team', order: 'updated_at.desc' });
  const rows = await request(`/rest/v1/playlists?${query}`, accessToken);
  return rows.map(({ playlist_items = [], ...playlist }) => ({
    ...playlist, song_ids: playlist_items.sort((a,b) => a.position-b.position).map(item => item.song_id),
  }));
}
export async function createPrivateAudioUrl(storagePath, accessToken, expiresIn = 3600) {
  if (!storagePath) throw new Error('Song has no storage path');
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const result = await request(`/storage/v1/object/sign/${AUDIO_BUCKET}/${encodedPath}`, accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  const signedPath = result.signedURL || result.signedUrl;
  if (!signedPath) throw new Error('Supabase did not return a signed audio URL');
  // Storage returns /object/sign/... (relative to /storage/v1), not the project root.
  if (/^https?:\/\//i.test(signedPath)) return signedPath;
  const normalizedPath = signedPath.startsWith('/storage/v1/')
    ? signedPath
    : '/storage/v1/' + signedPath.replace(/^\//, '');
  return new URL(normalizedPath, url).toString();
}
export async function updateTeamSong(accessToken, id, changes) {
  const allowed = ['title','artist','start_point','end_point','volume','tags','category','notes','play_count','loudness_db'];
  const patch = Object.fromEntries(Object.entries(changes).filter(([k])=>allowed.includes(k)));
  if (!Object.keys(patch).length) return;
  return request(`/rest/v1/songs?id=eq.${encodeURIComponent(id)}&team_id=eq.${encodeURIComponent(TEAM_ID)}`, accessToken, {
    method:'PATCH', headers:{'Content-Type':'application/json','Prefer':'return=representation'}, body:JSON.stringify(patch),
  });
}

export async function saveTeamPlaylist(accessToken, { id = null, name, hotkey = '', song_ids = [] }) {
  return request('/rest/v1/rpc/save_team_playlist', accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_team_id: TEAM_ID, p_playlist_id: id,
      p_name: name, p_hotkey: hotkey || '', p_song_ids: song_ids,
    }),
  });
}

export async function deleteTeamPlaylist(accessToken, id) {
  return request('/rest/v1/rpc/delete_team_playlist', accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_team_id: TEAM_ID, p_playlist_id: id }),
  });
}

/**
 * Team-only MP3 upload. The songs row is created FIRST because the private
 * Storage INSERT policy checks songs.storage_path and legacy_id.
 * Standard Storage upload is limited to 6 MiB in this test; add TUS later.
 */
export async function uploadTeamMp3(accessToken, file, metadata = {}) {
  if (!TEAM_ID) throw new Error('Supabase team ID missing');
  if (!file || file.size < 1 || file.size > 6 * 1024 * 1024) {
    throw new Error('For this test, select an MP3 smaller than 6 MB.');
  }
  if (!/\.mp3$/i.test(file.name)) throw new Error('Only MP3 uploads are enabled for this test.');
  const legacyId = crypto.randomUUID();
  const storagePath = `${TEAM_ID}/${legacyId}.mp3`;
  const payload = {
    team_id: TEAM_ID, scope: 'team', legacy_id: legacyId,
    title: file.name.replace(/\.mp3$/i, '').slice(0, 250),
    artist: 'Unknown', source: 'local', storage_path: storagePath,
    duration: Math.max(0, Math.round(metadata.duration || 0)),
    start_point: 0, volume: metadata.volume ?? 100, tags: [],
    ...(Number.isFinite(metadata.loudness_db) ? { loudness_db: metadata.loudness_db } : {}),
  };
  const created = await request('/rest/v1/songs?select=*', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!Array.isArray(created) || created.length !== 1) {
    throw new Error('Unable to create the song database entry.');
  }
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${url}/storage/v1/object/${AUDIO_BUCKET}/${encodedPath}`, {
    method: 'POST',
    headers: headers(accessToken, {
      'Content-Type': 'audio/mpeg',
      'x-upsert': 'false',
    }),
    body: file,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    // Do not automatically delete a song that may have been uploaded in a
    // partial network failure. Show an explicit error for manual recovery.
    throw new Error(`Song entry created, but audio upload failed: ${result?.message || result?.error || response.status}. Avoid uploading this file again until checked.`);
  }
  const file_url = await createPrivateAudioUrl(storagePath, accessToken, 3600);
  return { ...created[0], file_url, preview_url: '' };
}
