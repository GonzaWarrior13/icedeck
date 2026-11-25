begin;

grant insert (end_point) on public.songs to authenticated;

alter table public.playlists
  add column shared_source_playlist_id uuid references public.playlists(id) on delete set null,
  add constraint playlists_team_shared_source_unique unique (team_id, shared_source_playlist_id);

-- The existing shared-song function defines exactly which audio is offered.
-- A single JSON result avoids the API's row limit for a full library download.
create function public.get_shared_library_bundle()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(shared) || jsonb_build_object(
    'start_point', song.start_point, 'end_point', song.end_point, 'volume', song.volume
  ) order by shared.title, shared.id), '[]'::jsonb)
  from public.list_shared_team_songs() shared
  join public.songs song on song.id = shared.id;
$$;

create function public.copy_shared_library_setlists(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  source_team uuid;
  source_list record;
  destination_id uuid;
  local_song_ids uuid[];
  ready_count integer;
  added integer := 0;
  skipped integer := 0;
begin
  if not public.can_edit_team(p_team_id) then
    raise exception 'You cannot add setlists to this team' using errcode = '42501';
  end if;
  select team_id into source_team from public.shared_library_source;
  if source_team is null or source_team = p_team_id then
    return jsonb_build_object('added', 0, 'skipped', 0);
  end if;

  for source_list in
    select id, name from public.playlists
    where team_id = source_team and scope = 'team'
    order by id
  loop
    if exists (select 1 from public.playlists
      where team_id = p_team_id and shared_source_playlist_id = source_list.id) then
      continue;
    end if;

    select array_agg(local_song.id order by item.position), count(local_audio.name)
    into local_song_ids, ready_count
    from public.playlist_items item
    left join public.songs local_song on local_song.team_id = p_team_id
      and local_song.scope = 'team' and local_song.shared_source_song_id = item.song_id
    left join storage.objects local_audio on local_audio.bucket_id = 'icedeck-audio'
      and local_audio.name = local_song.storage_path
    where item.playlist_id = source_list.id;

    if coalesce(cardinality(local_song_ids), 0) = 0 then continue; end if;
    if ready_count <> cardinality(local_song_ids) then
      skipped := skipped + 1;
      continue;
    end if;

    insert into public.playlists (team_id, scope, name, shared_source_playlist_id)
    values (p_team_id, 'team', source_list.name, source_list.id)
    on conflict on constraint playlists_team_shared_source_unique do nothing
    returning id into destination_id;
    if destination_id is null then continue; end if;

    insert into public.playlist_items (playlist_id, song_id, position)
    select destination_id, track_id, (ordinality - 1)::integer
    from unnest(local_song_ids) with ordinality as tracks(track_id, ordinality);
    added := added + 1;
  end loop;

  return jsonb_build_object('added', added, 'skipped', skipped);
end;
$$;

revoke all on function public.get_shared_library_bundle(), public.copy_shared_library_setlists(uuid)
  from public, anon, authenticated;
grant execute on function public.get_shared_library_bundle(), public.copy_shared_library_setlists(uuid)
  to authenticated;

commit;
