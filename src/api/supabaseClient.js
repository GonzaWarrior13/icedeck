// Migration-only Supabase client. No service-role keys in browser code.
const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const isSupabaseConfigured = Boolean(url && key);
export const AUDIO_BUCKET = 'icedeck-audio';
export const TEAM_ID = import.meta.env.VITE_SUPABASE_TEAM_ID || '';
// Selected team exists only in this tab; never trust it for authorization.
let selectedTeamId = '';
export function setSelectedTeamId(id) { selectedTeamId = id || ''; }
export function getSelectedTeamId() { return selectedTeamId; }
export async function getSignedInUser(accessToken) {
  const user = await request('/auth/v1/user', accessToken);
  if (!user?.id) throw new Error('Supabase could not verify the signed-in user.');
  return { id: user.id, email: user.email || '' };
}
export async function getMyTeams(accessToken, knownUser = null) {
  // RLS permits members to view their teammates. We must filter memberships
  // by the *signed-in user's UID* or an unrelated admin's role may be shown.
  const user = knownUser?.id ? knownUser : await getSignedInUser(accessToken);
  const params = new URLSearchParams({
    select: 'team_id,user_id,role',
    user_id: `eq.${user.id}`,
  });
  const memberships = await request(`/rest/v1/team_memberships?${params}`, accessToken);
  if (!memberships.length) return [];
  const ids = memberships.map(m => m.team_id);
  const teamParams = new URLSearchParams({ select: 'id,name', id: `in.(${ids.join(',')})` });
  const teams = await request(`/rest/v1/teams?${teamParams}`, accessToken);
  return teams.map(team => ({
    ...team,
    role: memberships.find(m => m.team_id === team.id && m.user_id === user.id)?.role || 'viewer',
  }));
}

function headers(token, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${token || key}`, ...extra };
}
async function request(path, token, options = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase configuration missing');
  const response = await fetch(`${url}${path}`, {
    ...options, headers: headers(token, options.headers),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.msg || data?.error_description || `Supabase HTTP ${response.status}`);
    error.status = response.status;
    error.code = data?.error_code || data?.code;
    throw error;
  }
  return data;
}
export async function signIn(email, password) {
  try {
    return await request('/auth/v1/token?grant_type=password', null, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    if (error.code === 'invalid_credentials' || (typeof error.code !== 'string' && error.status === 400)) {
      throw new Error('Incorrect email or password. Check your details and try again.');
    }
    if (error.status === 429) throw new Error('Too many sign-in attempts. Wait a moment and try again.');
    throw new Error('Sign-in is temporarily unavailable. Please try again in a moment.');
  }
}
export async function requestPasswordReset(email) {
  const destination = new URL('/', window.location.origin);
  destination.searchParams.set('password-recovery', '1');
  return request('/auth/v1/recover?redirect_to=' + encodeURIComponent(destination.toString()), null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}
export async function verifyPasswordSetupToken(tokenHash, type) {
  return request('/auth/v1/verify', null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_hash: tokenHash, type }),
  });
}
export async function changePassword(token, newPassword) {
  return request('/auth/v1/user', token, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPassword }),
  });
}
export async function signOut(accessToken) {
  if (!accessToken) return;
  return request('/auth/v1/logout', accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  });
}
export async function createTeam(name) {
  return request('/rest/v1/rpc/create_team', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_name: name }),
  });
}
export async function getTeamMembers(teamId = getSelectedTeamId()) {
  return request('/rest/v1/rpc/list_team_members', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_team_id: teamId }),
  });
}
export async function manageTeamMember(email, role, teamId = getSelectedTeamId()) {
  return request('/rest/v1/rpc/manage_team_member', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_team_id: teamId, p_email: email, p_role: role }),
  });
}
export async function removeTeamMember(userId, teamId = getSelectedTeamId()) {
  return request('/rest/v1/rpc/remove_team_member', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_team_id: teamId, p_user_id: userId }),
  });
}
export async function transferTeamOwnership(userId, teamId = getSelectedTeamId()) {
  return request('/rest/v1/rpc/transfer_team_ownership', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_team_id: teamId, p_new_owner_id: userId }),
  });
}
export async function getMyNickname() {
  return request('/rest/v1/rpc/get_my_nickname', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
}
export async function setMyNickname(nickname) {
  return request('/rest/v1/rpc/set_my_nickname', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_nickname: nickname }),
  });
}
export async function deleteMyAccount() {
  // A service-role token is NEVER included in the browser.
  return request('/functions/v1/delete-account', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
}

export async function refreshSession(refreshToken) {
  return request('/auth/v1/token?grant_type=refresh_token', null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
export async function getTeamSongs(accessToken, teamId = getSelectedTeamId()) {
  if (!teamId) throw new Error('Team ID not configured');
  const query = new URLSearchParams({ select: '*', team_id: `eq.${teamId}`, scope: 'eq.team', order: 'updated_at.desc' });
  return request(`/rest/v1/songs?${query}`, accessToken);
}
export async function getTeamPlaylists(accessToken, teamId = getSelectedTeamId()) {
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
export async function recordTeamSongPlay(id) {
  if (!id || !getSelectedTeamId()) return;
  return request('/rest/v1/rpc/record_song_play', await getFreshPreviewToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_song_id: id, p_team_id: getSelectedTeamId() }),
  });
}
export async function updateTeamSong(accessToken, id, changes) {
  const allowed = ['title','artist','start_point','end_point','volume','tags','category','notes','play_count','loudness_db'];
  const patch = Object.fromEntries(Object.entries(changes).filter(([k])=>allowed.includes(k)));
  if (!Object.keys(patch).length) return;
  return request(`/rest/v1/songs?id=eq.${encodeURIComponent(id)}&team_id=eq.${encodeURIComponent(getSelectedTeamId())}`, accessToken, {
    method:'PATCH', headers:{'Content-Type':'application/json','Prefer':'return=representation'}, body:JSON.stringify(patch),
  });
}

export async function saveTeamPlaylist(accessToken, { id = null, name, hotkey = '', song_ids = [] }) {
  return request('/rest/v1/rpc/save_team_playlist', accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_team_id: getSelectedTeamId(), p_playlist_id: id,
      p_name: name, p_hotkey: hotkey || '', p_song_ids: song_ids,
    }),
  });
}

export async function deleteTeamPlaylist(accessToken, id) {
  return request('/rest/v1/rpc/delete_team_playlist', accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_team_id: getSelectedTeamId(), p_playlist_id: id }),
  });
}

// The project may impose a lower global limit than this bucket.
export const MAX_MP3_BYTES = 50 * 1024 * 1024;
export const SUPPORTED_AUDIO = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', wav: 'audio/wav', ogg: 'audio/ogg' };
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

// Use native TUS 1.0 for larger files. Each chunk can be retried by reading
// the server's authoritative Upload-Offset rather than repeating bytes.
async function uploadResumableMp3(file, storagePath, contentType) {
  const origin = new URL(url);
  const storageHost = origin.hostname.replace('.supabase.co', '.storage.supabase.co');
  const endpoint = origin.protocol + '//' + storageHost + '/storage/v1/upload/resumable';
  const base64 = value => btoa(String(value));
  const metadata = {
    bucketName: AUDIO_BUCKET,
    objectName: storagePath,
    contentType,
    cacheControl: '3600',
  };
  const token = await getFreshPreviewToken();
  const created = await fetch(endpoint, {
    method: 'POST',
    headers: headers(token, {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(file.size),
      'Upload-Metadata': Object.entries(metadata).map(([k,v]) => k + ' ' + base64(v)).join(','),
      'x-upsert': 'false',
    }),
  });
  if (!created.ok) throw new Error('Resumable upload could not begin: HTTP ' + created.status);
  const location = created.headers.get('Location');
  if (!location) throw new Error('Storage did not return an upload URL.');
  const target = new URL(location, endpoint);
  if (target.origin !== new URL(endpoint).origin) throw new Error('Unexpected storage upload destination.');

  let offset = 0;
  let retries = 0;
  while (offset < file.size) {
    const end = Math.min(file.size, offset + TUS_CHUNK_BYTES);
    try {
      const response = await fetch(target.toString(), {
        method: 'PATCH',
        headers: headers(await getFreshPreviewToken(), {
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        }),
        body: file.slice(offset, end),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const advanced = Number(response.headers.get('Upload-Offset'));
      offset = Number.isFinite(advanced) && advanced > offset ? advanced : end;
      retries = 0;
    } catch (error) {
      if (++retries > 4) throw new Error('Upload interrupted: ' + error.message);
      const head = await fetch(target.toString(), {
        method: 'HEAD',
        headers: headers(await getFreshPreviewToken(), { 'Tus-Resumable': '1.0.0' }),
      });
      if (!head.ok) throw new Error('Could not resume upload: HTTP ' + head.status);
      offset = Number(head.headers.get('Upload-Offset') || offset);
      await new Promise(resolve => setTimeout(resolve, 500 * retries));
    }
  }
}

/**
 * Team-only audio upload. The songs row is created FIRST because the private
 * Storage INSERT policy checks songs.storage_path and legacy_id.
 * Uses ordinary upload for <= 6 MiB and TUS for larger recordings.
 */
export async function uploadTeamMp3(accessToken, file, metadata = {}) {
  if (!getSelectedTeamId()) throw new Error('Supabase team ID missing');
  if (!file || file.size < 1 || file.size > MAX_MP3_BYTES) {
    throw new Error('Select an audio file smaller than 50 MB (your Supabase plan may set a lower limit).');
  }
  const extension = file.name.split('.').pop().toLowerCase();
  const contentType = SUPPORTED_AUDIO[extension];
  if (!contentType) throw new Error('Supported formats: MP3, M4A, MP4, WAV, OGG.');
  const legacyId = crypto.randomUUID();
  const storagePath = `${getSelectedTeamId()}/${legacyId}.${extension}`;
  const payload = {
    team_id: getSelectedTeamId(), scope: 'team', legacy_id: legacyId,
    title: (metadata.title?.trim() || file.name.replace(/\.[^.]+$/i, '')).slice(0, 250),
    artist: (metadata.artist?.trim() || 'Unknown').slice(0, 250), source: 'local', storage_path: storagePath,
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
  try {
    if (file.size > TUS_CHUNK_BYTES) {
      await uploadResumableMp3(file, storagePath, contentType);
    } else {
      const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${url}/storage/v1/object/${AUDIO_BUCKET}/${encodedPath}`, {
        method: 'POST',
        headers: headers(await getFreshPreviewToken(), {
          'Content-Type': contentType,
          'x-upsert': 'false',
        }),
        body: file,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || result?.error || 'HTTP ' + response.status);
      }
    }
  } catch (error) {
    // Preserve the row for manual recovery: the storage upload might have
    // completed while the network response was lost.
    throw Object.assign(new Error('Audio upload interrupted', { cause: error }), { code: 'audio_upload_incomplete' });
  }
  const audioUrlExpiresAt = Date.now() + 59 * 60_000;
  const file_url = await createPrivateAudioUrl(storagePath, await getFreshPreviewToken(), 3600).catch(() => '');
  return { ...created[0], file_url, audioUrlExpiresAt: file_url ? audioUrlExpiresAt : 0 };
}

export async function getSharedTeamSongs() {
  return request('/rest/v1/rpc/list_shared_team_songs', await getFreshPreviewToken());
}

export async function copySharedTeamSong(song) {
  const teamId = getSelectedTeamId();
  const token = await getFreshPreviewToken();
  const sourceUrl = await createPrivateAudioUrl(song.storage_path, token, 120);
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error('Could not read the shared audio. Try again.');
  const audio = await response.blob();
  if (teamId !== getSelectedTeamId()) throw new Error('Your active team changed. Open the shared library again.');
  const file = new File([audio], song.storage_path.split('/').at(-1), { type: audio.type });
  return uploadTeamMp3(token, file, song);
}

/** In-memory session for the migration preview; never stored in localStorage. */
let previewSession = null;
const SESSION_STORAGE_KEY = 'icedeck_supabase_session';
export function getStoredPreviewSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    return stored?.access_token && stored?.refresh_token ? stored : null;
  } catch { return null; }
}
export function setPreviewSession(session) {
  previewSession = session ? { ...session, _receivedAt: Date.now() / 1000 } : null;
  try {
    if (previewSession) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(previewSession));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}
export async function getFreshPreviewToken() {
  if (!previewSession) previewSession = getStoredPreviewSession();
  if (!previewSession?.access_token) throw Object.assign(new Error('Session missing'), { status: 401 });
  const expiresAt = previewSession.expires_at ||
    (previewSession.issued_at ? previewSession.issued_at + previewSession.expires_in : 0);
  // Normal Supabase sessions include expires_at; the initial login may not.
  if (expiresAt && Date.now() / 1000 < expiresAt - 120) return previewSession.access_token;
  if (!expiresAt && previewSession._receivedAt && Date.now() / 1000 < previewSession._receivedAt + (previewSession.expires_in || 3600) - 120) return previewSession.access_token;
  if (!previewSession.refresh_token) throw Object.assign(new Error('Session expired'), { status: 401 });
  const refreshed = await refreshSession(previewSession.refresh_token);
  setPreviewSession(refreshed);
  return previewSession.access_token;
}

/**
 * Delete a team song from the database (playlist_items cascade automatically)
 * then clean up the associated private MP3 through the Storage API.
 * Database deletion happens first, so a failed file cleanup cannot leave a
 * playable library entry pointing to a missing object.
 */
export async function deleteTeamSong(id) {
  if (!getSelectedTeamId() || !id) throw new Error('Missing team or song ID');
  const token = await getFreshPreviewToken();
  const query = new URLSearchParams({
    id: `eq.${id}`,
    team_id: `eq.${getSelectedTeamId()}`,
    scope: 'eq.team',
    select: 'id,storage_path',
  });
  const deleted = await request(`/rest/v1/songs?${query}`, token, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
  if (!Array.isArray(deleted) || deleted.length !== 1) {
    throw new Error('Song was not deleted. Check team permissions.');
  }
  const path = deleted[0].storage_path;
  let cleanupError = null;
  if (path) {
    if (!path.startsWith(`${getSelectedTeamId()}/`)) {
      cleanupError = 'Unexpected audio path; manual Storage cleanup is needed.';
    } else {
      try {
        const storageToken = await getFreshPreviewToken();
        const response = await fetch(`${url}/storage/v1/object/${AUDIO_BUCKET}`, {
          method: 'DELETE',
          headers: headers(storageToken, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ prefixes: [path] }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.message || result?.error || `HTTP ${response.status}`);
        }
      } catch (error) {
        cleanupError = error.message || 'Storage removal failed';
      }
    }
  }
  return { removed: true, cleanupError };
}
