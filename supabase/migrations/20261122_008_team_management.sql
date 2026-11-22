-- IceDeck: secure team management and editable display names.
-- Run after 20261122_007_user_nicknames.sql in Supabase SQL Editor.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT '',
  CONSTRAINT user_profiles_nickname_length CHECK (char_length(nickname) <= 80)
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_my_nickname(p_nickname text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF length(trim(coalesce(p_nickname,''))) > 80 THEN RAISE EXCEPTION 'Nickname is too long'; END IF;
  INSERT INTO public.user_profiles(user_id,nickname)
  VALUES ((SELECT auth.uid()),trim(coalesce(p_nickname,'')))
  ON CONFLICT (user_id) DO UPDATE SET nickname = EXCLUDED.nickname;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_nickname()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT p.nickname FROM public.user_profiles p WHERE p.user_id=(SELECT auth.uid())),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.list_team_members(p_team_id uuid)
RETURNS TABLE(user_id uuid, email text, nickname text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_team_admin(p_team_id) THEN RAISE EXCEPTION 'Team admin permissions required'; END IF;
  RETURN QUERY
  SELECT m.user_id, u.email::text,
         coalesce(nullif(trim(p.nickname),''), split_part(u.email::text,'@',1)),
         m.role
  FROM public.team_memberships m
  JOIN auth.users u ON u.id=m.user_id
  LEFT JOIN public.user_profiles p ON p.user_id=m.user_id
  WHERE m.team_id=p_team_id
  ORDER BY case m.role when 'owner' then 0 when 'admin' then 1 when 'dj' then 2 else 3 end, u.email;
END $$;

-- No Auth admin key is required in the browser. The target must already
-- have a Supabase Auth account, and role changes are checked on the server.
CREATE OR REPLACE FUNCTION public.manage_team_member(p_team_id uuid,p_email text,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_caller_role text; v_target uuid; v_existing_role text;
BEGIN
  SELECT m.role INTO v_caller_role FROM public.team_memberships m
  WHERE m.team_id=p_team_id AND m.user_id=(SELECT auth.uid());
  IF v_caller_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Team admin permissions required'; END IF;
  IF p_role NOT IN ('admin','dj','viewer') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_role='admin' AND v_caller_role <> 'owner' THEN RAISE EXCEPTION 'Only owners can promote admins'; END IF;
  SELECT u.id INTO v_target FROM auth.users u
  WHERE lower(u.email)=lower(trim(coalesce(p_email,''))) LIMIT 1;
  IF v_target IS NULL THEN RAISE EXCEPTION 'User not found. Ask them to register first'; END IF;
  IF v_target=(SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  SELECT m.role INTO v_existing_role FROM public.team_memberships m WHERE m.team_id=p_team_id AND m.user_id=v_target;
  IF v_existing_role='owner' THEN RAISE EXCEPTION 'Transfer ownership instead'; END IF;
  IF v_existing_role='admin' AND v_caller_role<>'owner' THEN RAISE EXCEPTION 'Only the owner can change admins'; END IF;
  INSERT INTO public.team_memberships(team_id,user_id,role) VALUES(p_team_id,v_target,p_role)
  ON CONFLICT (team_id,user_id) DO UPDATE SET role=excluded.role;
END $$;

CREATE OR REPLACE FUNCTION public.remove_team_member(p_team_id uuid,p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_caller_role text; v_target_role text;
BEGIN
  SELECT m.role INTO v_caller_role FROM public.team_memberships m
  WHERE m.team_id=p_team_id AND m.user_id=(SELECT auth.uid());
  IF v_caller_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Team admin permissions required'; END IF;
  IF p_user_id=(SELECT auth.uid()) THEN RAISE EXCEPTION 'Cannot remove yourself'; END IF;
  SELECT m.role INTO v_target_role FROM public.team_memberships m
  WHERE m.team_id=p_team_id AND m.user_id=p_user_id;
  IF v_target_role='owner' THEN RAISE EXCEPTION 'Transfer ownership instead'; END IF;
  IF v_target_role='admin' AND v_caller_role<>'owner' THEN RAISE EXCEPTION 'Only the owner can remove admins'; END IF;
  DELETE FROM public.team_memberships WHERE team_id=p_team_id AND user_id=p_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(p_team_id uuid,p_new_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_old_owner uuid;
BEGIN
  SELECT t.created_by INTO v_old_owner FROM public.teams t WHERE t.id=p_team_id FOR UPDATE;
  IF v_old_owner IS DISTINCT FROM (SELECT auth.uid()) THEN RAISE EXCEPTION 'Only the current owner can transfer ownership'; END IF;
  IF p_new_owner_id=v_old_owner THEN RAISE EXCEPTION 'Select another member'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_memberships m WHERE m.team_id=p_team_id AND m.user_id=p_new_owner_id)
    THEN RAISE EXCEPTION 'New owner must already belong to the team'; END IF;
  UPDATE public.team_memberships SET role='admin' WHERE team_id=p_team_id AND user_id=v_old_owner;
  UPDATE public.team_memberships SET role='owner' WHERE team_id=p_team_id AND user_id=p_new_owner_id;
  UPDATE public.teams SET created_by=p_new_owner_id WHERE id=p_team_id;
END $$;

REVOKE ALL ON FUNCTION public.set_my_nickname(text), public.get_my_nickname(),
 public.list_team_members(uuid), public.manage_team_member(uuid,text,text),
 public.remove_team_member(uuid,uuid), public.transfer_team_ownership(uuid,uuid)
 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_nickname(text), public.get_my_nickname(),
 public.list_team_members(uuid), public.manage_team_member(uuid,text,text),
 public.remove_team_member(uuid,uuid), public.transfer_team_ownership(uuid,uuid)
 TO authenticated;
COMMIT;
