# IceDeck app connection (migration branch only)

This is a first-stage browser adapter; it does **not** replace the existing Base44 authentication or playback pipeline yet.

## Local configuration

Create a local `.env.local` (never commit it):

```env
VITE_SUPABASE_URL=https://sifnxxepwqrgmwdzqcrm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_TEAM_ID=83e682d0-c902-44b6-a2b2-0b191a543e66
```

The publishable key is intended for browser clients. Never put a secret/service-role key or user password in Vite variables or GitHub.

## Adapter

`src/api/supabaseClient.js` implements:
- email/password sign-in and token refresh
- RLS-protected team song and playlist reads
- playlist ordering through `playlist_items`
- short-lived signed private-audio URLs
- scoped song metadata updates

## Important before switching UI

- Verify authenticated read and signed-URL playback with a real team member; dashboard preview alone is not a valid RLS test.
- Confirm SQL grants for authenticated on `playlists` and `playlist_items` (and needed mutations) while keeping RLS enabled.
- Wire session lifecycle, login/logout, team selection, signed-URL renewal, audio prefetch and cached queue recovery.
- Replace Base44 mutations and uploads throughout the application, then test cue points, end points, fades, volume, goal horn, hotkeys, and all playlists.
- Keep Base44 production on `main` unchanged until acceptance tests pass.
- Do not expose team-uploaded copyrighted MP3s through a global public library without rights clearance.
