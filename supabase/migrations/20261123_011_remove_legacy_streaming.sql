begin;

-- Keep existing team songs, playable assets and setlist references.
alter table public.songs
  drop column if exists spotify_id,
  drop column if exists spotify_uri,
  drop column if exists preview_url;

update public.songs
set source = 'local'
where source = 'spotify';

commit;
