begin;

-- A database operator enables sharing explicitly by inserting the source team.
create table public.shared_library_source (
  singleton boolean primary key default true check (singleton),
  team_id uuid not null references public.teams(id) on delete cascade
);
alter table public.shared_library_source enable row level security;
revoke all on public.shared_library_source from public, anon, authenticated;

create function public.list_shared_team_songs()
returns table (id uuid, title text, artist text, duration numeric, storage_path text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.title, s.artist, s.duration, s.storage_path
  from public.shared_library_source source
  join public.songs s on s.team_id = source.team_id and s.scope = 'team'
  join storage.objects o on o.bucket_id = 'icedeck-audio' and o.name = s.storage_path
  where s.storage_path like source.team_id::text || '/%'
    and lower(s.storage_path) ~ '\.(mp3|m4a|mp4|wav|ogg)$'
    and exists (
      select 1 from public.team_memberships m where m.user_id = (select auth.uid())
    )
  order by s.title, s.id;
$$;

create function public.can_copy_shared_team_audio(object_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_memberships m
    where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin', 'dj')
  ) and exists (
    select 1 from public.shared_library_source source
    join public.songs s on s.team_id = source.team_id and s.scope = 'team'
    where s.storage_path = object_name and object_name like source.team_id::text || '/%'
      and lower(object_name) ~ '\.(mp3|m4a|mp4|wav|ogg)$'
  );
$$;

revoke all on function public.list_shared_team_songs(), public.can_copy_shared_team_audio(text)
  from public, anon, authenticated;
grant execute on function public.list_shared_team_songs(), public.can_copy_shared_team_audio(text)
  to authenticated;

create policy rinkbeats_shared_team_audio_read on storage.objects for select to authenticated
  using (bucket_id = 'icedeck-audio' and public.can_copy_shared_team_audio(name));

commit;
