# RinkBeats standalone deployment

The hosted build uses Vite and Supabase with Vercel. The legacy Base44 deployment is outside this launch. Use Preview and a staging Supabase project for release checks.

1. Apply the existing migrations in version order on a new database. For an existing database, check its applied migrations and apply only pending ones. Migration 011 drops retired streaming metadata. Back up and test against staging first. Migration 012 adds the shared catalog and its Storage policies.
2. Use an existing Supabase user ID to seed catalog administration via the SQL Editor. Never grant this role from the frontend.

   ```sql
   insert into public.catalog_admins (user_id)
   values ('REPLACE_WITH_OWNER_AUTH_USER_UUID'::uuid)
   on conflict do nothing;
   ```

3. In Supabase Auth, set the canonical HTTPS Site URL and explicit Preview and recovery redirect URLs. Disable public signups and anonymous sign-ins if the project is dedicated to RinkBeats. Invite users from the dashboard and create or assign team memberships before launch. Verify an invite, first password setup, password reset, and subsequent sign-in using a staging account. Keep the invite email and recovery email on the staging domain when testing.
4. Set Preview variables for the migration branch first. Use the existing configuration names `VITE_ICEDECK_STANDALONE=true`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and optionally `VITE_ICEDECK_GOAL_HORN_URL`. Remove the retired integration variables and OAuth callback configuration when switching environments to the new build. Keep server keys outside `VITE_*`.
5. Build using `npm ci` and `npm run build`, and host the `dist` directory. `vercel.json` provides browser routing. Validate on Preview before any production promotion. The repository includes a synthesized goal horn.
6. Deploy the account-deletion Edge Function separately to the intended Supabase project and verify it using a disposable account. The function refuses deletion while the user owns a team.
7. Test free, paid, expired, admin, and unauthorized identities against both the catalog API and the private audio endpoint. Verify the physical phone, output device, queue, cue editor, goal horn, file upload and account lifecycle before opening the launch.

The launch build supports the private team library. Catalog queries and payment integration need to be connected using the new schema before advertising shared catalog tiers.

## Enable the IceDeck-Main shared library

Apply migration `20261124_013_shared_team_library.sql` to the Supabase project that holds both the source and destination teams. Start on staging. The migration leaves sharing off until a database operator selects the source team.

In the SQL Editor, look up the source team and confirm its UUID. If multiple teams match, verify the right team before enabling sharing.

```sql
select id, name from public.teams where name ilike '%IceDeck-Main%';

insert into public.shared_library_source (team_id)
values ('REPLACE_WITH_SOURCE_TEAM_UUID'::uuid);
```

This shares existing and future supported audio files stored in that team's private audio folder with signed-in team members. Use a source team containing only recordings approved for sharing. Owners, admins and DJs can add a separate copy to a team they can edit. Test with a second team by copying a song, refreshing the library, then playing, cueing and deleting the copy. The source remains intact. To stop future sharing, run `delete from public.shared_library_source;`. Copies already imported remain in their teams.

Apply `20261124_014_shared_library_dedup.sql` after migration 013 and after registering the source team. This limits each team to one copy per shared track. The migration links older copies when their stored audio fingerprint, title and artist identify a single match. It leaves ambiguous copies intact. After applying it, test that the Add button stays disabled after a refresh and becomes available after deleting the team's copy.
