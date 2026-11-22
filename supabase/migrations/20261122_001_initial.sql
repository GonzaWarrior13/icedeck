-- IceDeck schema v1. Run only in a NEW Supabase project.
-- No Base44 production operations. All audio remains private.
begin;

create extension if not exists pgcrypto;

create table public.teams (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);

create table public.team_memberships (
 team_id uuid not null references public.teams(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','dj','viewer')),
 created_at timestamptz not null default now(),
 primary key (team_id,user_id)
);

create table public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);

-- SECURITY DEFINER helpers avoid recursive RLS on membership checks.
create function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
 select 1 from public.team_memberships m
 where m.team_id=p_team and m.user_id=(select auth.uid())
) $$;

create function public.can_edit_team(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
 select 1 from public.team_memberships m
 where m.team_id=p_team and m.user_id=(select auth.uid())
 and m.role in ('owner','admin','dj')
) $$;

create function public.is_team_admin(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
 select 1 from public.team_memberships m
 where m.team_id=p_team and m.user_id=(select auth.uid())
 and m.role in ('owner','admin')
) $$;

create function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
 select 1 from public.platform_admins a where a.user_id=(select auth.uid())
) $$;

revoke all on function public.is_team_member(uuid), public.can_edit_team(uuid),
 public.is_team_admin(uuid), public.is_platform_admin() from public, anon;
grant execute on function public.is_team_member(uuid), public.can_edit_team(uuid),
 public.is_team_admin(uuid), public.is_platform_admin() to authenticated;

create table public.songs (
 id uuid primary key default gen_random_uuid(),
 team_id uuid references public.teams(id),
 scope text not null default 'team' check (scope in ('team','global')),
 legacy_id text unique,
 title text not null,
 artist text,
 duration numeric,
 storage_path text,
 source text,
 preview_url text,
 spotify_id text,
 spotify_uri text,
 start_point numeric,
 end_point numeric,
 tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags)='array'),
 category text,
 energy_level text,
 bpm numeric,
 volume numeric,
 loudness_db numeric,
 play_count integer not null default 0,
 notes text,
 is_sample boolean,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint song_scope_owner check (
  (scope='team' and team_id is not null) or
  (scope='global' and team_id is null)
 ),
 constraint song_storage_path_unique unique (storage_path)
);

create table public.playlists (
 id uuid primary key default gen_random_uuid(),
 team_id uuid references public.teams(id),
 scope text not null default 'team' check (scope in ('team','global')),
 legacy_id text unique,
 name text not null,
 description text,
 hotkey text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint playlist_scope_owner check (
  (scope='team' and team_id is not null) or
  (scope='global' and team_id is null)
 )
);

create table public.playlist_items (
 playlist_id uuid not null references public.playlists(id) on delete cascade,
 song_id uuid not null references public.songs(id) on delete cascade,
 position integer not null check (position >= 0),
 primary key (playlist_id,position),
 unique (playlist_id,song_id)
);

create index songs_team_idx on public.songs(team_id);
create index playlists_team_idx on public.playlists(team_id);
create index memberships_user_idx on public.team_memberships(user_id);

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;

-- Team creation uses a controlled function that also assigns the owner.
create function public.create_team(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if length(trim(p_name)) not between 1 and 120 then raise exception 'Invalid team name'; end if;
 insert into public.teams(name,created_by) values (trim(p_name),(select auth.uid())) returning id into v_id;
 insert into public.team_memberships(team_id,user_id,role)
 values (v_id,(select auth.uid()),'owner');
 return v_id;
end $$;
revoke all on function public.create_team(text) from public, anon;
grant execute on function public.create_team(text) to authenticated;

create policy teams_read on public.teams for select to authenticated
 using (public.is_team_member(id));
create policy teams_update on public.teams for update to authenticated
 using (public.is_team_admin(id)) with check (public.is_team_admin(id));
-- No direct insert/delete: create_team and trusted admin operations only.

create policy membership_read on public.team_memberships for select to authenticated
 using (public.is_team_member(team_id));
-- Membership changes are server-admin only in v1; no client insert/update/delete.

-- No client access to platform_admins (even SELECT); helpers expose only boolean.

create policy songs_read on public.songs for select to authenticated
 using ((scope='global') or (scope='team' and public.is_team_member(team_id)));
create policy songs_insert on public.songs for insert to authenticated
 with check (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 );
create policy songs_update on public.songs for update to authenticated
 using (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 )
 with check (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 );
create policy songs_delete on public.songs for delete to authenticated
 using (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 );

create policy playlists_read on public.playlists for select to authenticated
 using ((scope='global') or (scope='team' and public.is_team_member(team_id)));
create policy playlists_insert on public.playlists for insert to authenticated
 with check (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 );
create policy playlists_update on public.playlists for update to authenticated
 using (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 )
 with check (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 );
create policy playlists_delete on public.playlists for delete to authenticated
 using (
  (scope='team' and public.can_edit_team(team_id))
  or (scope='global' and public.is_platform_admin())
 );

-- Items must be readable only if both playlist and song are readable.
create policy items_read on public.playlist_items for select to authenticated
 using (
  exists(select 1 from public.playlists p where p.id=playlist_id)
  and exists(select 1 from public.songs s where s.id=song_id)
 );
-- Only insert songs into a playlist when the playlist editor has access
-- AND the song belongs to that same team, or is global.
create policy items_insert on public.playlist_items for insert to authenticated
 with check (
  exists (
   select 1 from public.playlists p join public.songs s on s.id=song_id
   where p.id=playlist_id
   and (
    (p.scope='team' and public.can_edit_team(p.team_id)
      and (s.scope='global' or (s.scope='team' and s.team_id=p.team_id)))
    or (p.scope='global' and public.is_platform_admin() and s.scope='global')
   )
  )
 );
create policy items_delete on public.playlist_items for delete to authenticated
 using (
  exists (
   select 1 from public.playlists p where p.id=playlist_id
   and ((p.scope='team' and public.can_edit_team(p.team_id))
      or (p.scope='global' and public.is_platform_admin()))
  )
 );
-- Reorder by deleting/reinserting; no direct UPDATE in v1.

-- Private bucket. Browser uploads/downloads need separate signed-URL
-- authorization through trusted server code, not a public bucket.
insert into storage.buckets (id,name,public,file_size_limit)
values ('icedeck-audio','icedeck-audio',false,262144000)
on conflict (id) do nothing;

commit;
