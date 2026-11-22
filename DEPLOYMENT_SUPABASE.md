# IceDeck standalone Supabase deployment (migration branch only)

The original Base44 production app is **not** being replaced by this procedure.

## Prerequisites
- Sign-in, playlists, editing, uploads and team isolation verified in the Supabase migration preview.
- `public/goal-horn.mp3` committed to the migration branch if using the locally hosted horn. Confirm you have rights to distribute the audio.

## Build a standalone version locally
On Windows PowerShell:
```powershell
$env:VITE_ICEDECK_STANDALONE="true"
npm run build
Remove-Item Env:\VITE_ICEDECK_STANDALONE
```
This builds `dist/` without the Base44 Vite plugin. Existing Base44 code remains in the source repository for migration comparison, but the standalone app launches only the Supabase interface.

## Hosting on Vercel (when ready)
1. Import GitHub repo `GonzaWarrior13/icedeck`.
2. Select branch `migration/supabase-schema-2026-11-22`. Do **not** deploy the default/main branch for this migration test.
3. Framework preset: Vite; build command: `npm run build`; output directory: `dist`.
4. Configure environment variables for that deployment:
   - `VITE_ICEDECK_STANDALONE=true`
   - `VITE_SUPABASE_URL=https://sifnxxepwqrgmwdzqcrm.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: your Supabase **publishable/anon** key (never a service-role key)
   - `VITE_ICEDECK_GOAL_HORN_URL`: optional, defaults to `/goal-horn.mp3`
5. Redeploy after setting environment variables, then verify sign-in and team isolation.

Do **not** configure `VITE_SUPABASE_TEAM_ID`: the selected team is now determined by the signed-in user's membership.

## Known blockers before public launch
- More-than-one-hour audio/session renewal has not been tested during continuous play.
- The browser bundle still contains some unused legacy Base44 imports. They are not supposed to be executed in standalone mode; complete removal/clean build audit remains open.
- Upload currently limits MP3 files to 6 MiB.
- Confirm secure storage rules, error handling and licensing before distributing to other teams.
- Goal horn and private MP3 playback require an internet connection except the locally hosted horn while the app is loaded.
