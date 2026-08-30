let sdkLoadPromise = null;

function loadSdk() {
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.Spotify) return resolve(window.Spotify);
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    s.onerror = () => reject(new Error('Failed to load Spotify Web Playback SDK'));
    document.body.appendChild(s);
  });
  return sdkLoadPromise;
}

export class SpotifyEngine {
  constructor() {
    this.player = null;
    this.deviceId = null;
    this.getToken = null;
    this.ready = false;
    this.onStateChange = null;
    this.onEnd = null;
    this._endedFired = false;
    this._poll = null;
    let resolveReady;
    this.readyPromise = new Promise((r) => { resolveReady = r; });
    this._resolveReady = resolveReady;
  }

  async init(getToken) {
    this.getToken = getToken;
    const Spotify = await loadSdk();
    if (this.player) { try { await this.player.disconnect(); } catch (_) {} }
    this.player = new Spotify.Player({
      name: 'IceDeck DJ',
      getOAuthToken: (cb) => cb(this.getToken() || ''),
      volume: 1,
    });
    this.player.addListener('ready', ({ device_id }) => {
      this.deviceId = device_id;
      this.ready = true;
      this._resolveReady();
      this._startPoll();
    });
    this.player.addListener('not_ready', () => { this.ready = false; });
    this.player.addListener('player_state_changed', (state) => {
      if (state) this.onStateChange?.(state);
    });
    ['initialization_error', 'authentication_error', 'account_error', 'playback_error'].forEach((ev) => {
      this.player.addListener(ev, (m) => console.warn('Spotify', ev, m));
    });
    await this.player.connect();
  }

  _startPoll() {
    if (this._poll) return;
    this._poll = setInterval(async () => {
      if (!this.player) return;
      try {
        const state = await this.player.getCurrentState();
        if (!state) return;
        this.onStateChange?.(state);
        if (!state.paused && state.duration > 0 && state.position >= state.duration - 350) {
          if (!this._endedFired) { this._endedFired = true; this.onEnd?.(); }
        } else if (state.position < state.duration - 1000) {
          this._endedFired = false;
        }
      } catch (_) {}
    }, 500);
  }

  async playUri(uri, positionMs = 0) {
    if (!this.ready) await this.readyPromise;
    const token = this.getToken();
    this._endedFired = false;
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri], position_ms: Math.round(positionMs) })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error('Spotify play failed: ' + t.slice(0, 200));
    }
  }

  async resume() { try { await this.player.resume(); } catch (_) {} }
  async pause() { try { await this.player.pause(); } catch (_) {} }
  async seek(ms) { try { await this.player.seek(Math.round(ms)); } catch (_) {} }
  async setVolume(v) { try { await this.player.setVolume(v); } catch (_) {} }
  async disconnect() {
    if (this._poll) { clearInterval(this._poll); this._poll = null; }
    try { await this.player?.disconnect(); } catch (_) {}
    this.player = null;
    this.ready = false;
  }
}