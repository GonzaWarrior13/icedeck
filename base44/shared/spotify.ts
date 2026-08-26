import { secrets } from "base44:runtime";

let cachedToken = null;
let cachedExpiry = 0;

export async function getSpotifyToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExpiry - 60000) return cachedToken;
  const clientId = secrets.get("SPOTIFY_CLIENT_ID");
  const clientSecret = secrets.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured");
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`)
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify token error: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedExpiry = now + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function spotifyGet(path) {
  let token = await getSpotifyToken();
  let res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 401) {
    cachedToken = null;
    token = await getSpotifyToken();
    res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  return res;
}