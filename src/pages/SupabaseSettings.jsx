import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { usePlaylists } from '@/hooks/useDjData';
import { useSimpleMode } from '@/lib/simpleMode';

// Supabase settings use verified session data; never call Base44 auth.
export default function SupabaseSettings({ user, team }) {
  const navigate = useNavigate();
  const { data: playlists = [] } = usePlaylists();
  const { enabled, playlistIds, setEnabled, setPlaylistIds, togglePlaylist } = useSimpleMode();
  const toggleSimpleMode = (on) => {
    if (on && playlistIds.length === 0) setPlaylistIds(playlists.map((p) => p.id));
    setEnabled(on);
    // Switch immediately to the home route so the console is visible.
    if (on) navigate('/');
  };

  return (
    <div className="px-5 md:px-10 py-6 md:py-10 space-y-10 max-w-[720px]">
      <header>
        <h1 className="font-display text-[44px] md:text-[56px] font-semibold leading-[0.95]">Settings</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Your account, team and this device.</p>
      </header>

      <section className="space-y-4">
        <p className="section-label">Account</p>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-secondary text-primary font-display text-xl font-semibold flex items-center justify-center">
            {(user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-semibold">Supabase account</p>
            <p className="truncate text-sm text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" aria-hidden="true" /> {user?.email || 'Unknown user'}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-8 space-y-3">
        <p className="section-label">Current team</p>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="font-medium">{team?.name || 'No team selected'}</span>
          {team?.role && <span className="rounded bg-secondary px-2 py-1 text-xs capitalize">{team.role}</span>}
        </div>
        <p className="text-sm text-muted-foreground">Use the Switch team button in the upper-right corner to choose another team.</p>
      </section>

      <section className="border-t border-border pt-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="section-label">Simple mode</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Game-day view with play/pause, the goal horn, and only the setlists you pick.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={toggleSimpleMode}
            aria-label="Simple mode"
            className="shrink-0 mt-1"
          />
        </div>
        {enabled && (
          <div className="space-y-2 pt-1">
            <p className="section-label">Setlists shown</p>
            {playlists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No setlists yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6">
                {playlists.map((pl) => (
                  <label key={pl.id} className="flex items-center gap-3 min-h-11 rounded-[8px] hover:bg-secondary/50">
                    <Checkbox
                      checked={playlistIds.includes(pl.id)}
                      onCheckedChange={() => togglePlaylist(pl.id)}
                      aria-label={pl.name}
                    />
                    <span className="truncate text-sm flex-1">{pl.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{(pl.song_ids || []).length}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="border-t border-border pt-8 space-y-2">
        <p className="section-label">Account management</p>
        <p className="text-sm text-muted-foreground">
          Account deletion and password management are not available in this migration test.
          They require independent Supabase account-management workflows; the former Base44 actions have not been reused.
        </p>
      </section>
    </div>
  );
}
