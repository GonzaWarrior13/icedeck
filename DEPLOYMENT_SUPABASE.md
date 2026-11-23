# IceDeck standalone Supabase deployment checklist

All migration changes are on branch `migration/supabase-schema-2026-11-22`.
**Do not deploy this over the live Base44 app.** This is a separate test deployment.

## 1. Apply database migrations

In the existing Supabase project, run the contents of these files in the SQL Editor, in this order:

- `supabase/migrations/20261122_008_team_management.sql` — secure team membership, nicknames, and owner transfer
- `supabase/migrations/20261122_009_play_tracking.sql` — song UPDATE grants and atomic play counts
- `supabase/migrations/20261122_010_audio_formats.sql` — private upload permission for MP3, M4A, MP4, WAV, OGG

The original migrations 001–007 should already exist; do not rerun 001 because it creates the original schema.
New management RPCs work only after migration 008 is applied.

## 2. Local standalone build

On Windows Command Prompt:

```cmd
git pull
set VITE_ICEDECK_STANDALONE=true
npm run build
npm run dev
```

Open `http://localhost:5173/`. To test Spotify OAuth locally, instead use
`http://127.0.0.1:5173/` from start to finish (Spotify no longer accepts
ordinary `http://localhost` redirect URIs for new integrations).

## 3. Deploy account deletion function

Requires Supabase CLI credentials. Run from the repository:

```cmd
npx supabase login
npx supabase functions deploy delete-account --project-ref sifnxxepwqrgmwdzqcrm
```

The function verifies the user's Supabase Auth token server-side.
Never put the Supabase service-role key into any `VITE_*` variable or in Git.
The function refuses deletion until team ownership is transferred to someone else.
`supabase/config.toml` configures the function to verify the token in its own code.

## 4. Configure optional identity providers

For **Google sign-in**, enable Google in Supabase Authentication > Providers.
Add your Google OAuth client ID and client secret in Supabase, and authorize
Supabase's callback URI in Google Cloud. Whitelist local and hosted app redirect
URLs in Supabase Authentication > URL Configuration.

For **email signup and password recovery**, verify Supabase Auth email
configuration, email templates, SMTP limits, and the redirect allowlist.
Test the emails before opening registration to customers.

## 5. Configure Spotify OAuth

Create a Spotify Developer app. Obtain a Client ID (NOT the Client Secret).
Add `VITE_SPOTIFY_CLIENT_ID` as a Vite environment variable.

Register exact Spotify redirect URIs:
- local: `http://127.0.0.1:5173/spotify-callback`
- hosted: `https://YOUR-DEPLOYMENT-DOMAIN/spotify-callback`

To test full tracks for personal listening, open
`http://127.0.0.1:5173/?spotify=1` in desktop Chrome or Edge. Sign into IceDeck,
connect Spotify Premium from the Library, and add a Spotify track link. This uses a separate
Spotify session from playlist browsing. For a personal Vercel deployment, set `VITE_ICEDECK_STANDALONE=true`,
`VITE_SPOTIFY_CLIENT_ID`, and `VITE_ICEDECK_SPOTIFY_ORIGIN` in the deployment's
environment. Set the origin to the stable HTTPS address with no trailing slash
and register that address plus `/spotify-callback` in Spotify. Redeploy after
updating the environment. Leave the Spotify origin unset on rink deployments.
Saved personal tracks are browser-local and scoped to the site's origin.

Spotify uses Authorization Code + PKCE and may restrict Development Mode
to Spotify Premium owners and a small allowlist of users. IceDeck can
connect and browse playlist metadata, but **cannot play Spotify's full
tracks or copy them into Storage** via the Web API. Full Spotify playback
requires its permitted playback SDK, eligibility, and a licensing review
for commercial arena use.

## 6. Deploy the test app to Vercel

Import `GonzaWarrior13/icedeck` from GitHub, select branch
`migration/supabase-schema-2026-11-22`, Vite preset, command
`npm run build`, output `dist`.

Set deployment environment variables:
- `VITE_ICEDECK_STANDALONE=true`
- `VITE_SUPABASE_URL=https://sifnxxepwqrgmwdzqcrm.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key>`
- `VITE_SPOTIFY_CLIENT_ID=<Spotify public app Client ID>` (optional)
- `VITE_ICEDECK_GOAL_HORN_URL=/goal-horn.mp3` (optional)

Do not set `VITE_SUPABASE_TEAM_ID`: team selection is membership-driven.
Add and commit your **horn-only, licensed** `public/goal-horn.mp3` separately;
the MP3 is not currently tracked in the GitHub branch. Without that file,
the hosted horn URL will not exist.

## 7. Tests required before public use

- Build should pass `npm run build` or the migration branch GitHub Actions build.
- Check viewer, DJ, owner, and admin permissions, including attempted direct API mutations.
- Check cross-team isolation and membership role changes while app is open.
- Test signup, confirmation email, password reset, Google OAuth, and log out.
- Test secure account deletion with a disposable non-owner account, after deployment.
- Test Spotify OAuth with a development-allowlisted user.
- Test Quick Access stars, queue restore after sign-in/reload, Simple Mode,
  goal-shuffle, and refreshing after another DJ makes a change.
- Test uploading a disposable >6 MB MP3 and one M4A/WAV file; actual Supabase project size and browser codec limits apply.
- Test 65+ minute playback and recovery from dropped internet.
- Check song deletion removes both the song row and private storage object.
- Review music licensing/arena playback rights before any paid product launch.

## Known limitations

- Hosted Spotify access supports authenticated playlist browsing. Personal playback is available in local development or on the configured HTTPS origin.
- The hosted goal horn requires `public/goal-horn.mp3` from the user.
- Existing Base44 code and SDK remain in the source branch to preserve the
  original app, even though standalone mode bypasses its authentication and APIs.
- Larger multi-format TUS uploads and new account flows are not yet runtime-verified.
- Queue restores by song ID after selecting a team, but autoplay is intentionally not triggered.
