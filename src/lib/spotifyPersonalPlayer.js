import {
  completeSpotifyStandaloneAuth, disconnectSpotifyStandalone, getAccessToken,
  spotifyConnected, startSpotifyStandaloneAuth,
} from '@/lib/spotifyStandalone';

export function mountPersonalSpotify(root) {
  const listeners = new AbortController();
  const status = root.querySelector('#status');
  const error = root.querySelector('#error');
  const connect = root.querySelector('#connect');
  const controls = root.querySelector('#controls');
  const play = root.querySelector('#play');
  const toggle = root.querySelector('#toggle');
  const trackInput = root.querySelector('#track');
  trackInput.value = sessionStorage.getItem('icedeck_personal_track') || '';
  const figure = root.querySelector('figure');
  const cover = figure.querySelector('img');
  const caption = figure.querySelector('figcaption');
  const progress = root.querySelector('#progress');
  let player;
  let deviceId;
  let playing = false;
  let starting = false;

  function showError(cause) {
    error.hidden = false;
    error.textContent = cause.message || String(cause);
  }

  function updateButtons() {
    play.disabled = !deviceId || starting;
    toggle.disabled = !playing;
  }

  function showPlayerState(state) {
    const track = state?.track_window?.current_track;
    playing = Boolean(track);
    updateButtons();
    figure.hidden = !track;
    toggle.textContent = state?.paused ? 'Resume' : 'Pause';
    if (!track) return;
    caption.textContent = track.name + ' — ' + track.artists.map(artist => artist.name).join(', ');
    const image = track.album?.images?.[0]?.url;
    cover.hidden = !image;
    if (image) cover.src = image;
    else cover.removeAttribute('src');
  }

  function updateProgress(state) {
    if (!state?.track_window?.current_track) {
      progress.textContent = '';
      return;
    }
    const seconds = Math.floor(state.position / 1000);
    progress.textContent = (state.paused ? 'Paused at ' : 'Playing at ') +
      Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function trackUri(input) {
    const uri = input.trim().match(/^spotify:track:([A-Za-z0-9]{22})$/);
    if (uri) return uri[0];
    const link = new URL(input.trim());
    const match = link.pathname.match(/^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})\/?$/i);
    if (link.origin !== 'https://open.spotify.com' || !match) throw new Error('Paste the Spotify share link for one track.');
    return 'spotify:track:' + match[1];
  }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.Spotify?.Player) return resolve();
      const timer = setTimeout(() => reject(new Error('Spotify’s playback SDK did not load. Reload to try again.')), 15000);
      window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timer); resolve(); };
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.onerror = () => { clearTimeout(timer); reject(new Error('Spotify’s playback SDK could not load.')); };
      document.head.append(script);
    });
  }

  async function checkProtectedAudio() {
    if (!navigator.requestMediaKeySystemAccess) return false;
    try {
      await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
        initDataTypes: ['cenc'],
        audioCapabilities: [{contentType: 'audio/mp4; codecs="mp4a.40.2"'}],
      }]);
      return true;
    } catch {
      return false;
    }
  }

  async function startPlayer() {
    status.textContent = 'Connecting the browser player…';
    controls.hidden = false;
    if (!await checkProtectedAudio()) {
      status.textContent = 'This browser cannot play Spotify?s protected audio.';
      showError(new Error('Open http://127.0.0.1:5173/ directly in desktop Chrome or Edge to continue.'));
      return;
    }
    await loadSdk();
    if (listeners.signal.aborted) return;
    player = new Spotify.Player({
      name: 'IceDeck Personal Test',
      volume: 0.4,
      getOAuthToken: callback => { getAccessToken(true).then(callback).catch(showError); },
    });
    player.addListener('ready', ({device_id}) => {
      deviceId = device_id;
      status.textContent = 'Player ready. Paste a track link to listen.';
      updateButtons();
    });
    player.addListener('not_ready', () => {
      deviceId = undefined;
      showPlayerState(null);
      status.textContent = 'Spotify player offline. Reload to reconnect.';
    });
    player.addListener('player_state_changed', showPlayerState);
    player.addListener('player_state_changed', updateProgress);
    player.addListener('autoplay_failed', () => showError(new Error('Browser playback was blocked. Click Play track again.')));
    for (const name of ['initialization_error','authentication_error','account_error','playback_error']) {
      player.addListener(name, showError);
    }
    if (!await player.connect()) throw new Error('Could not connect the Spotify browser player.');
  }

  connect.addEventListener('click', () => startSpotifyStandaloneAuth(true).catch(showError), {signal: listeners.signal});
  root.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!deviceId || starting) return;
    error.hidden = true;
    starting = true;
    updateButtons();
    try {
      let uri;
      try { uri = trackUri(trackInput.value); }
      catch { throw new Error('Paste the Spotify share link for one track.'); }
      sessionStorage.setItem('icedeck_personal_track', trackInput.value);
      await player.activateElement();
      const response = await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + encodeURIComponent(deviceId), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + await getAccessToken(true)},
        body: JSON.stringify({uris:[uri]}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Spotify could not start playback (' + response.status + ').');
      }
    } catch (cause) {
      showError(cause);
    } finally {
      starting = false;
      updateButtons();
    }
  }, {signal: listeners.signal});

  toggle.addEventListener('click', () => player.togglePlay().catch(showError), {signal: listeners.signal});
  root.querySelector('#disconnect').addEventListener('click', () => {
    player?.disconnect();
    disconnectSpotifyStandalone(true);
    location.replace('/spotify-personal');
  }, {signal: listeners.signal});

  async function initialize() {
    try {
      if (location.pathname === '/spotify-callback') await completeSpotifyStandaloneAuth(true);
      if (spotifyConnected(true)) await startPlayer();
      else {
        status.textContent = 'Connect your Spotify Premium account.';
        connect.hidden = false;
      }
    } catch (cause) {
      if (location.pathname === '/spotify-callback') history.replaceState({}, '', '/spotify-personal');
      status.textContent = 'Spotify setup needs attention.';
      connect.hidden = false;
      showError(cause);
    }

  }
  initialize();
  const clock = setInterval(() => player?.getCurrentState().then(updateProgress).catch(showError), 1000);
  return () => {
    listeners.abort();
    clearInterval(clock);
    player?.disconnect();
  };
}
