import { getSelectedTeamId } from '@/api/supabaseClient';
import { useCallback, useEffect, useState } from 'react';

const ENABLED_KEY = 'dj_simple_mode';
const IDS_KEY = 'dj_simple_playlists';
const EVENT = 'dj-simple-mode-change';
const scoped = key => {
  const isMigration = import.meta.env.VITE_ICEDECK_STANDALONE === 'true' || ['/supabase-original','/supabase-dj'].includes(window.location.pathname);
  return isMigration ? `${key}:team:${getSelectedTeamId() || 'none'}` : key;
};

export const readSimpleMode = () => {
  try {
    return localStorage.getItem(scoped(ENABLED_KEY)) === '1';
  } catch {
    return false;
  }
};

export const readSimplePlaylistIds = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(scoped(IDS_KEY)));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(scoped(key), value);
  } catch {
    /* storage unavailable in some WebViews */
  }
  window.dispatchEvent(new Event(EVENT));
};

export const setSimpleModeEnabled = (enabled) => write(ENABLED_KEY, enabled ? '1' : '0');

export const setSimplePlaylistIds = (ids) => write(IDS_KEY, JSON.stringify(ids));

// Simple mode lives in localStorage and stays in sync across the layout,
// the settings screen and the console through one change event.
export function useSimpleMode() {
  const [enabled, setEnabledState] = useState(readSimpleMode);
  const [playlistIds, setPlaylistIdsState] = useState(readSimplePlaylistIds);

  useEffect(() => {
    const sync = () => {
      setEnabledState(readSimpleMode());
      setPlaylistIdsState(readSimplePlaylistIds());
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setEnabled = useCallback((next) => setSimpleModeEnabled(next), []);
  const setPlaylistIds = useCallback((ids) => setSimplePlaylistIds(ids), []);
  const togglePlaylist = useCallback((id) => {
    const current = readSimplePlaylistIds();
    setSimplePlaylistIds(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }, []);

  return { enabled, playlistIds, setEnabled, setPlaylistIds, togglePlaylist };
}