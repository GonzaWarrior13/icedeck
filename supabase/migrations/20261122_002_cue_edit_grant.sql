-- Allow authenticated team editors to update ONLY cue points and volume.
-- RLS songs_update already requires can_edit_team(team_id).
-- Apply in the existing Supabase project before testing Save.
GRANT UPDATE (start_point, end_point, volume) ON TABLE public.songs TO authenticated;
