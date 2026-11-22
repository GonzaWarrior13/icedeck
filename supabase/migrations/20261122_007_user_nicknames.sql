-- Human-friendly nicknames for Supabase dashboard administration.
-- Keep UUID foreign keys: changing IDs to nicknames would break Auth and RLS.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT '',
  CONSTRAINT user_profiles_nickname_length CHECK (char_length(nickname) <= 80)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- No client-side SELECT/UPDATE policies: only trusted dashboard administrators
-- should manage user identities in this migration test.
REVOKE ALL ON public.user_profiles FROM anon, authenticated;

-- Pre-create profile rows for accounts that already exist.
INSERT INTO public.user_profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Readable, dashboard-friendly view. Edit nicknames in user_profiles,
-- memberships and roles in team_memberships. UUIDs stay intact.
CREATE OR REPLACE VIEW public.team_memberships_named
WITH (security_invoker = true)
AS
SELECT
  tm.team_id,
  t.name AS team_name,
  tm.user_id,
  coalesce(nullif(trim(p.nickname), ''), u.email::text, tm.user_id::text) AS user_name,
  tm.role,
  tm.created_at
FROM public.team_memberships AS tm
JOIN public.teams AS t ON t.id = tm.team_id
LEFT JOIN public.user_profiles AS p ON p.user_id = tm.user_id
LEFT JOIN auth.users AS u ON u.id = tm.user_id;

REVOKE ALL ON public.team_memberships_named FROM PUBLIC, anon, authenticated;
COMMIT;
