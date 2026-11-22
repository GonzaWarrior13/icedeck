-- IceDeck migration: transactional playlist editor
-- Run in the EXISTING Supabase project (never Base44).
BEGIN;

GRANT SELECT, INSERT, DELETE ON TABLE public.playlists TO authenticated;
GRANT UPDATE (name, hotkey, updated_at) ON TABLE public.playlists TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.playlist_items TO authenticated;

CREATE OR REPLACE FUNCTION public.save_team_playlist(
  p_team_id uuid,
  p_playlist_id uuid,
  p_name text,
  p_hotkey text,
  p_song_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
  v_count integer;
BEGIN
  IF NOT public.can_edit_team(p_team_id) THEN
    RAISE EXCEPTION 'Not authorized to edit this team';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Playlist name must be 1 to 120 characters';
  END IF;
  IF p_song_ids IS NULL THEN p_song_ids := ARRAY[]::uuid[]; END IF;
  IF cardinality(p_song_ids) > 500 THEN
    RAISE EXCEPTION 'Too many tracks';
  END IF;
  IF p_hotkey IS NOT NULL AND p_hotkey <> ''
     AND lower(p_hotkey) !~ '^([a-z0-9]|f([1-9]|1[0-2]))$' THEN
    RAISE EXCEPTION 'Invalid hotkey';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.songs AS s
  WHERE s.id = ANY(p_song_ids)
    AND (s.scope = 'global' OR (s.scope = 'team' AND s.team_id = p_team_id));
  IF v_count <> cardinality(p_song_ids) THEN
    RAISE EXCEPTION 'Some songs are unavailable or duplicated';
  END IF;

  IF p_playlist_id IS NULL THEN
    INSERT INTO public.playlists(team_id, scope, name, hotkey)
    VALUES (p_team_id, 'team', trim(p_name), lower(coalesce(p_hotkey, '')))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.playlists
    SET name = trim(p_name),
        hotkey = lower(coalesce(p_hotkey, '')),
        updated_at = now()
    WHERE id = p_playlist_id AND team_id = p_team_id AND scope = 'team'
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Playlist not found or not editable';
    END IF;
    DELETE FROM public.playlist_items WHERE playlist_id = v_id;
  END IF;

  INSERT INTO public.playlist_items(playlist_id, song_id, position)
  SELECT v_id, track_id, (ordinality - 1)::integer
  FROM unnest(p_song_ids) WITH ORDINALITY AS tracks(track_id, ordinality);

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_team_playlist(
  p_team_id uuid,
  p_playlist_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  IF NOT public.can_edit_team(p_team_id) THEN
    RAISE EXCEPTION 'Not authorized to edit this team';
  END IF;
  DELETE FROM public.playlists
  WHERE id = p_playlist_id AND team_id = p_team_id AND scope = 'team';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Playlist not found or not editable';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_team_playlist(uuid,uuid,text,text,uuid[]),
  public.delete_team_playlist(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_team_playlist(uuid,uuid,text,text,uuid[]),
  public.delete_team_playlist(uuid,uuid) TO authenticated;

COMMIT;
