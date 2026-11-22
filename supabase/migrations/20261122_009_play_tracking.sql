-- IceDeck final per-song grants and atomic play count tracking.
-- Apply AFTER the initial schema and migration 008.
BEGIN;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, DELETE ON public.songs TO authenticated;
REVOKE INSERT ON public.songs FROM authenticated;
GRANT INSERT (
 team_id, scope, legacy_id, title, artist, source, storage_path,
 duration, start_point, volume, tags, loudness_db
) ON public.songs TO authenticated;
-- Undo any earlier blanket UPDATE grant; keep sensitive ownership and
-- Storage path columns immutable from the public browser API.
REVOKE UPDATE ON public.songs FROM authenticated;
GRANT UPDATE (
 title, artist, start_point, end_point, volume, tags, category,
 notes, play_count, loudness_db, updated_at
) ON public.songs TO authenticated;

CREATE OR REPLACE FUNCTION public.record_song_play(p_song_id uuid, p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.is_team_member(p_team_id) THEN RETURN; END IF;
 UPDATE public.songs
 SET play_count = coalesce(play_count,0) + 1
 WHERE id = p_song_id AND team_id = p_team_id AND scope = 'team';
END $$;
REVOKE ALL ON FUNCTION public.record_song_play(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_song_play(uuid,uuid) TO authenticated;

COMMIT;
