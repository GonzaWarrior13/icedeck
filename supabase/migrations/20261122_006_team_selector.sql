-- Allow signed-in users to discover only their own team memberships
-- and the teams visible through existing RLS policies.
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.teams TO authenticated;
GRANT SELECT ON TABLE public.team_memberships TO authenticated;
COMMIT;
