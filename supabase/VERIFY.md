# Supabase schema verification checklist

Migration: `20261122_001_initial.sql`

**Not executed or verified against a live Supabase instance.** Apply only after review in the new project. Keep Base44 unchanged.

## Before running
- Save a copy of the SQL and confirm the project is the new IceDeck Supabase project.
- Never paste secrets into GitHub or a chat.
- Run migration in SQL Editor only once; this is an initial creation migration.
- If any statement fails, inspect the error before retrying (the transaction rolls back).

## Schema assertions (SQL Editor after migration)
```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in ('teams','team_memberships','platform_admins','songs','playlists','playlist_items')
order by tablename;

select id, public from storage.buckets where id = 'icedeck-audio';

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
Expect all six application tables with `rowsecurity=true`, one private bucket, and explicit policies.

## Required authenticated-user tests
Use at least two test accounts, A and B, and preferably a third account C.
1. A calls `select public.create_team('Test A');` and B calls `select public.create_team('Test B');` with authenticated sessions. Each sees only their own team.
2. A creates a team-scoped song and playlist. B cannot SELECT, UPDATE, or DELETE either.
3. B cannot insert a playlist item referring to A's private song.
4. A cannot directly add B to A's team via the browser API (membership writes are admin-only).
5. A cannot insert a global song or global playlist.
6. A cannot convert a team song or playlist to global without platform-admin authorization.
7. A can read a *metadata-only* global song published by a trusted admin; B can too.
8. Private storage object cannot be downloaded via public URL; do not enable public bucket access.
9. Unauthenticated requests cannot read application tables.
10. Deleting and recreating a playlist's item rows preserves intended ordering.

## Migration and playback checks
- Import 97 Song rows with legacy IDs, preserving metadata including start_point, end_point, volume, tags, loudness_db.
- Import 5 Playlist rows, mapping their legacy song_ids to the new UUID song IDs in the correct order.
- Upload 97 verified audio files to the private bucket. Never make them public as a shortcut.
- A trusted server endpoint must authorize access to each object and issue short-lived signed playback URLs. This endpoint is **not implemented yet**.
- Test playback, seeking, cue points, fades, Android behavior, and multi-user access before cutover.

## Known limitations / future work
- Team invitations and membership changes need a trusted admin workflow; client writes intentionally blocked.
- Publishing global content requires a platform-admin workflow and rights review.
- The browser app still calls Base44. Supabase data adapter, authentication migration, and upload/playback authorization are separate work.
- The SQL migration has not yet been tested against a live database or automated RLS test harness.
