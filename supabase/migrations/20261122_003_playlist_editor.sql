-- IceDeck playlist editor: transactional writes, restricted to team editors.
-- Run in the EXISTING Supabase project after initial schema.
begin;
grant select, insert, update (name, hotkey, updated_at), delete on public.playlists to authenticated;
grant select, insert, delete on public.playlist_items to authenticated;

create or replace function public.save_team_playlist(
  p_team_id uuid, p_playlist_id uuid, p_name text, p_hotkey text, p_song_ids uuid[]
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
begin
  if not public.can_edit_team(p_team_id) then
    raise exception 'Not authorized to edit this team';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'Playlist name must be 1–120 characters';
  end if;
  if p_song_ids is null then p_song_ids := array[]::uuid[]; end if;
  if cardinality(p_song_ids) > 500 then raise exception 'Too many tracks'; end if;
  if p_hotkey is not null and p_hotkey <> '' and
     lower(p_hotkey) !~ '^([a-z0-9]|f([1-9]|1[0-2])) then
    raise exception 'Invalid hotkey';
  end if;
  select count(*) into v_count
  from public.songs s
  where s.id = any(p_song_ids)
    and (s.scope = 'global' or (s.scope = 'team' and s.team_id = p_team_id));
  if v_count <> cardinality(p_song_ids) then
    raise exception 'Some songs are unavailable or duplicated';
  end if;

  if p_playlist_id is null then
    insert into public.playlists(team_id, scope, name, hotkey)
    values (p_team_id, 'team', trim(p_name), lower(coalesce(p_hotkey,'')))
    returning id into v_id;
  else
    update public.playlists
      set name = trim(p_name), hotkey = lower(coalesce(p_hotkey,'')), updated_at = now()
    where id = p_playlist_id and team_id = p_team_id and scope = 'team'
    returning id into v_id;
    if v_id is null then raise exception 'Playlist not found or not editable'; end if;
    delete from public.playlist_items where playlist_id = v_id;
  end if;
  insert into public.playlist_items(playlist_id, song_id, position)
  select v_id, track_id, (ordinality - 1)::integer
  from unnest(p_song_ids) with ordinality as tracks(track_id, ordinality);

  return v_id;
end $$;

create or replace function public.delete_team_playlist(p_team_id uuid, p_playlist_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.can_edit_team(p_team_id) then raise exception 'Not authorized to edit this team'; end if;
  delete from public.playlists
    where id = p_playlist_id and team_id = p_team_id and scope = 'team';
  if not found then raise exception 'Playlist not found or not editable'; end if;
end $$;

revoke all on function public.save_team_playlist(uuid,uuid,text,text,uuid[]),
  public.delete_team_playlist(uuid,uuid) from public, anon;
grant execute on function public.save_team_playlist(uuid,uuid,text,text,uuid[]),
  public.delete_team_playlist(uuid,uuid) to authenticated;
commit;
 then
    raise exception 'Invalid hotkey';
  end if;
  select count(*) into v_count
  from public.songs s
  where s.id = any(p_song_ids)
    and (s.scope = 'global' or (s.scope = 'team' and s.team_id = p_team_id));
  if v_count <> cardinality(p_song_ids) then
    raise exception 'Some songs are unavailable or duplicated';
  end if;

  if p_playlist_id is null then
    insert into public.playlists(team_id, scope, name, hotkey)
    values (p_team_id, 'team', trim(p_name), lower(coalesce(p_hotkey,'')))
    returning id into v_id;
  else
    update public.playlists
      set name = trim(p_name), hotkey = lower(coalesce(p_hotkey,'')), updated_at = now()
    where id = p_playlist_id and team_id = p_team_id and scope = 'team'
    returning id into v_id;
    if v_id is null then raise exception 'Playlist not found or not editable'; end if;
    delete from public.playlist_items where playlist_id = v_id;
  end if;
  insert into public.playlist_items(playlist_id, song_id, position)
  select v_id, track_id, (ordinality - 1)::integer
  from unnest(p_song_ids) with ordinality as tracks(track_id, ordinality);

  return v_id;
end $$;

create or replace function public.delete_team_playlist(p_team_id uuid, p_playlist_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.can_edit_team(p_team_id) then raise exception 'Not authorized to edit this team'; end if;
  delete from public.playlists
    where id = p_playlist_id and team_id = p_team_id and scope = 'team';
  if not found then raise exception 'Playlist not found or not editable'; end if;
end $$;

revoke all on function public.save_team_playlist(uuid,uuid,text,text,uuid[]),
  public.delete_team_playlist(uuid,uuid) from public, anon;
grant execute on function public.save_team_playlist(uuid,uuid,text,text,uuid[]),
  public.delete_team_playlist(uuid,uuid) to authenticated;
commit;
