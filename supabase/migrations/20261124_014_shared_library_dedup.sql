begin;

alter table public.songs
  add column shared_source_song_id uuid references public.songs(id) on delete set null;

-- Older copies did not record their source. Link them only when the stored
-- audio and the title/artist match, with one unambiguous copy per team.
with matches as (
  select local_song.id as local_id, shared_song.id as source_id,
    count(*) over (partition by local_song.id) as source_matches,
    count(*) over (partition by local_song.team_id, shared_song.id) as team_matches
  from public.shared_library_source source
  join public.songs shared_song on shared_song.team_id = source.team_id
    and shared_song.scope = 'team'
    and shared_song.storage_path like source.team_id::text || '/%'
    and lower(shared_song.storage_path) ~ '\.(mp3|m4a|mp4|wav|ogg)$'
  join storage.objects original on original.bucket_id = 'icedeck-audio'
    and original.name = shared_song.storage_path
  join public.songs local_song on local_song.scope = 'team'
    and local_song.team_id <> source.team_id
    and local_song.storage_path like local_song.team_id::text || '/%'
    and local_song.title = shared_song.title
    and local_song.artist is not distinct from shared_song.artist
  join storage.objects copied on copied.bucket_id = 'icedeck-audio'
    and copied.name = local_song.storage_path
    and copied.metadata ->> 'eTag' = nullif(original.metadata ->> 'eTag', '')
)
update public.songs song
set shared_source_song_id = matches.source_id
from matches
where song.id = matches.local_id and matches.source_matches = 1 and matches.team_matches = 1;

alter table public.songs
  add constraint songs_team_shared_source_unique unique (team_id, shared_source_song_id);

grant insert (shared_source_song_id) on public.songs to authenticated;

-- Existing song insert policies still check the destination team. This gate
-- limits claimed sources to songs currently offered by the shared library.
create policy rinkbeats_shared_import_source on public.songs as restrictive
  for insert to authenticated
  with check (
    shared_source_song_id is null or exists (
      select 1 from public.list_shared_team_songs() source
      where source.id = shared_source_song_id
        and source.storage_path not like songs.team_id::text || '/%'
    )
  );

commit;
