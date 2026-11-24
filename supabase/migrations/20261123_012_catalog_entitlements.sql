begin;

-- Only a privileged database operator can assign catalog administrators.
create table public.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.catalog_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscription_status text not null check (subscription_status in
    ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  access_until timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now(),
  check (subscription_status not in ('trialing', 'active') or access_until is not null)
);

-- Only intentionally public teaser fields belong in either cards table.
create table public.catalog_song_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 250),
  artist text not null default '',
  is_free boolean not null default false
);
create table public.catalog_song_audio (
  song_id uuid primary key references public.catalog_song_cards(id) on delete cascade,
  object_path text not null unique check (length(btrim(object_path)) > 0),
  duration_seconds numeric not null check (duration_seconds > 0),
  start_seconds numeric not null default 0 check (start_seconds >= 0),
  end_seconds numeric,
  check (start_seconds < duration_seconds),
  check (end_seconds is null or (end_seconds > start_seconds and end_seconds <= duration_seconds))
);
create table public.catalog_setlist_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 250),
  description text not null default ''
);
create table public.catalog_setlist_items (
  setlist_id uuid not null references public.catalog_setlist_cards(id) on delete cascade,
  position integer not null check (position >= 0),
  song_id uuid not null references public.catalog_song_cards(id) on delete cascade,
  primary key (setlist_id, position)
);
create index catalog_setlist_items_song_idx on public.catalog_setlist_items(song_id);

alter table public.catalog_admins enable row level security;
alter table public.catalog_entitlements enable row level security;
alter table public.catalog_song_cards enable row level security;
alter table public.catalog_song_audio enable row level security;
alter table public.catalog_setlist_cards enable row level security;
alter table public.catalog_setlist_items enable row level security;

revoke all on public.catalog_admins, public.catalog_entitlements, public.catalog_song_cards,
  public.catalog_song_audio, public.catalog_setlist_cards, public.catalog_setlist_items
  from public, anon, authenticated;
grant select, insert, update, delete on public.catalog_entitlements to service_role;
grant select, insert, update, delete on public.catalog_song_cards, public.catalog_song_audio,
  public.catalog_setlist_cards, public.catalog_setlist_items to authenticated;

create function public.is_catalog_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.catalog_admins where user_id = (select auth.uid()));
$$;

create function public.has_catalog_access() returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_catalog_admin() or exists (
    select 1 from public.catalog_entitlements
    where user_id = (select auth.uid()) and subscription_status in ('trialing', 'active')
      and access_until > now()
  );
$$;

-- Match paths to entitled catalog rows. Authenticated callers can only get a
-- boolean for objects they are entitled to, with no cross-account lookup.
create function public.can_read_catalog_object(path text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.catalog_song_audio a
    join public.catalog_song_cards c on c.id = a.song_id
    where a.object_path = path and ((select auth.uid()) is not null)
      and (c.is_free or (select public.has_catalog_access()))
  );
$$;

revoke all on function public.is_catalog_admin(), public.has_catalog_access(), public.can_read_catalog_object(text)
  from public, anon, authenticated;
grant execute on function public.is_catalog_admin(), public.has_catalog_access(), public.can_read_catalog_object(text)
  to authenticated;

create policy catalog_song_cards_read on public.catalog_song_cards for select to authenticated using (true);
create policy catalog_setlist_cards_read on public.catalog_setlist_cards for select to authenticated using (true);
create policy catalog_song_audio_read on public.catalog_song_audio for select to authenticated using (
  (select public.has_catalog_access()) or exists (
    select 1 from public.catalog_song_cards c where c.id = song_id and c.is_free
  )
);
create policy catalog_items_read on public.catalog_setlist_items for select to authenticated
  using ((select public.has_catalog_access()));

create policy catalog_song_cards_admin on public.catalog_song_cards for all to authenticated
  using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy catalog_song_audio_admin on public.catalog_song_audio for all to authenticated
  using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy catalog_setlist_cards_admin on public.catalog_setlist_cards for all to authenticated
  using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy catalog_items_admin on public.catalog_setlist_items for all to authenticated
  using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

insert into storage.buckets (id, name, public)
values ('rinkbeats-catalog-audio', 'rinkbeats-catalog-audio', false);

-- Restrictive policies prevent unrelated permissive Storage policies from
-- granting broader access to this bucket.
create policy rinkbeats_catalog_storage_read_gate on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'rinkbeats-catalog-audio' or (select public.is_catalog_admin())
    or public.can_read_catalog_object(name));
create policy rinkbeats_catalog_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'rinkbeats-catalog-audio' and ((select public.is_catalog_admin()) or public.can_read_catalog_object(name)));
create policy rinkbeats_catalog_storage_admin on storage.objects for all to authenticated
  using (bucket_id = 'rinkbeats-catalog-audio' and (select public.is_catalog_admin()))
  with check (bucket_id = 'rinkbeats-catalog-audio' and (select public.is_catalog_admin()));
create policy rinkbeats_catalog_storage_insert_gate on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'rinkbeats-catalog-audio' or (select public.is_catalog_admin()));
create policy rinkbeats_catalog_storage_update_gate on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'rinkbeats-catalog-audio' or (select public.is_catalog_admin()))
  with check (bucket_id <> 'rinkbeats-catalog-audio' or (select public.is_catalog_admin()));
create policy rinkbeats_catalog_storage_delete_gate on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'rinkbeats-catalog-audio' or (select public.is_catalog_admin()));
create policy rinkbeats_catalog_storage_deny_anon on storage.objects as restrictive for all to anon
  using (bucket_id <> 'rinkbeats-catalog-audio') with check (bucket_id <> 'rinkbeats-catalog-audio');

commit;
