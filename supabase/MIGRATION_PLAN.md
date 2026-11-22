# IceDeck Supabase migration plan (draft — no production changes)

## Existing data
- Base44 Song CSV: 97 records with audio file URLs and cue metadata.
- Base44 Playlist CSV: 5 records with song_ids references.
- 97 audio files independently backed up and playback-checked by the user.
- Keep Base44 live until Supabase import, authorization, and player tests pass.

## Access model
- auth.users: Supabase Auth identities; never duplicate passwords.
- teams: team id, name, created_by, timestamps.
- team_memberships: team id, user id, role (owner/admin/dj/viewer), status.
- songs: song id, owner team id nullable, scope (team/global), storage object path, original Base44 id, metadata/cue/fade fields.
- playlists: playlist id, owner team id nullable, scope (team/global), original Base44 id, name/description/hotkey.
- playlist_items: playlist id, song id, position.

## Security invariants
1. RLS enabled on every application table; default deny until policies explicitly grant.
2. A user can read a team song/playlist only when an active member of its owning team.
3. Global songs/playlists are readable to authenticated users only after explicit publishing by an authorized admin.
4. Team membership management is restricted to authorized team administrators, with owner safeguards.
5. Writes and deletes require an authorized team role; avoid recursion in membership policies.
6. Audio storage remains private. Issue short-lived signed URLs only after database access checks, via trusted server code.
7. Never publish existing 97 files globally during migration; import into a single private team.
8. Do not commit Supabase service-role keys, database passwords, or user tokens to GitHub.
9. No cross-team copying or publishing of copyrighted audio without rights verification.

## Migration phases
1. Finalize schema against actual Base44 Song/Playlist field types and application usage.
2. Add versioned SQL migrations and RLS tests on this isolated branch.
3. Apply SQL to new Supabase project (no Base44 changes).
4. Import original CSV rows preserving legacy ids and ordered playlist references.
5. Upload audio to private bucket and update storage paths.
6. Implement and test Supabase auth and data adapters on separate app branch.
7. Test team isolation, global opt-in, Android playback, and rollback before cutover.

Status: Planning only. No SQL has been executed and no Supabase data has been modified.
