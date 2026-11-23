import {
  disconnectSpotifyStandalone, getAccessToken,
  spotifyConnected, startSpotifyStandaloneAuth,
} from '@/lib/spotifyStandalone';

export function mountPersonalSpotify(root, { setReady, beforePlay, onPlayback, onTrackEnded }) {
  const listeners = new AbortController();
  const status = root.querySelector('#status');
  const error = root.querySelector('#error');
  const connect = root.querySelector('#connect');
  const controls = root.querySelector('#controls');
  let player;
  let deviceId;
  let volume = 0.4;
  let selected = false;
  let requestedTrack;
  let lastPosition = 0;
  let finished = false;
  let starting = false;

  function showError(cause) {
    error.hidden = false;
    error.textContent = cause.message || String(cause);
  }

  function updateButtons() {
    if (!listeners.signal.aborted) setReady(Boolean(deviceId) && !starting);

  }

  function showPlayerState(state) {
    const track = state?.track_window?.current_track;
    if (!selected) return;
    if (!track) {
      onPlayback(null);
      return;
    }
    if (track.id !== requestedTrack?.id && track.linked_from?.id !== requestedTrack?.id) return;
    const end = requestedTrack.end_point > 0 ? requestedTrack.end_point * 1000 : state.duration;
    const naturalEnd = state.paused && lastPosition > 0 && lastPosition >= state.duration - 1500 && state.position === 0;
    lastPosition = state.position;
    if (!finished && (naturalEnd || (end > 0 && state.position >= end))) {
      finished = true;
      const endedTrack = requestedTrack;
      player.pause().then(() => {
        if (selected && requestedTrack === endedTrack) onTrackEnded?.(endedTrack.id);
      }).catch(showError);
    }
    onPlayback({
      currentSong: {
        id: track.id,
        title: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        cover: track.album?.images?.[0]?.url,
      },
      isPlaying: !state.paused,
      duration: state.duration / 1000,
      currentTime: state.position / 1000,
      masterVolume: volume,
      play: resume,
      pause,
      seek,
      setMasterVolume,
    });
  }

  async function resume() {
    try {
      beforePlay();
      await player.activateElement();
      if (finished) await playTrack(requestedTrack);
      else await player.resume();
    } catch (cause) {
      showError(cause);
    }
  }

  function pause() {
    player?.pause().catch(showError);
  }

  function seek(seconds) {
    player?.seek(Math.round(seconds * 1000)).catch(showError);
  }

  function setMasterVolume(value) {
    player?.setVolume(value).then(() => {
      volume = value;
      return player.getCurrentState();
    }).then(showPlayerState).catch(showError);
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
      showError(new Error('Open this IceDeck address directly in desktop Chrome or Edge to continue.'));
      return;
    }
    await loadSdk();
    if (listeners.signal.aborted) return;
    player = new Spotify.Player({
      name: 'IceDeck',
      volume,
      getOAuthToken: callback => { getAccessToken(true).then(callback).catch(showError); },
    });
    player.addListener('ready', ({device_id}) => {
      deviceId = device_id;
      status.textContent = 'Spotify connected';
      updateButtons();
    });
    player.addListener('not_ready', () => {
      deviceId = undefined;
      showPlayerState(null);
      status.textContent = 'Spotify player offline. Reload to reconnect.';
    });
    player.addListener('player_state_changed', showPlayerState);
    player.addListener('autoplay_failed', () => showError(new Error('Browser playback was blocked. Click Play again.')));
    for (const name of ['initialization_error','authentication_error','account_error','playback_error']) {
      player.addListener(name, showError);
    }
    if (!await player.connect()) throw new Error('Could not connect the Spotify browser player.');
  }

  connect.addEventListener('click', () => startSpotifyStandaloneAuth(true).catch(showError), {signal: listeners.signal});
  async function playTrack(track) {
    if (!deviceId || starting) return;
    error.hidden = true;
    starting = true;
    updateButtons();
    try {
      const uri = 'spotify:track:' + track.id;
      beforePlay();
      selected = true;
      requestedTrack = track;
      lastPosition = 0;
      finished = false;
      await player.activateElement();
      const token = await getAccessToken(true);
      if (!selected || listeners.signal.aborted) return;
      const response = await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + encodeURIComponent(deviceId), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
        body: JSON.stringify({uris:[uri], position_ms: Math.round((track.start_point || 0) * 1000)}),
        signal: listeners.signal,
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
  }

  root.querySelector('#disconnect').addEventListener('click', () => {
    player?.disconnect();
    disconnectSpotifyStandalone(true);
    location.replace('/');
  }, {signal: listeners.signal});

  async function initialize() {
    try {
      if (spotifyConnected(true)) await startPlayer();
      else {
        status.textContent = 'Connect your Spotify Premium account.';
        connect.hidden = false;
      }
    } catch (cause) {
      status.textContent = 'Spotify setup needs attention.';
      connect.hidden = false;
      showError(cause);
    }

  }
  initialize();
  const clock = setInterval(() => player?.getCurrentState().then(showPlayerState).catch(showError), 350);
  return {
    playTrack,
    interrupt() {
      if (!selected) return;
      selected = false;
      onPlayback(null);
      pause();
    },
    dispose() {
      listeners.abort();
      clearInterval(clock);
      selected = false;
      onPlayback(null);
      player?.disconnect();
    },
  };
}
