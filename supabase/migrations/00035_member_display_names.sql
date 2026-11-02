BEGIN;

-- Keep the original RPC available for clients deployed before this migration.
CREATE OR REPLACE FUNCTION public.list_workspace_members_v2()
RETURNS TABLE(user_id UUID, email TEXT, role TEXT, joined_at TIMESTAMPTZ, display_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id,
         COALESCE(u.email::TEXT, ''),
         m.role,
         m.joined_at,
         COALESCE(
           NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''),
           NULLIF(btrim(u.raw_user_meta_data->>'name'), ''),
           NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
           u.email::TEXT,
           'Miembro'
         )
  FROM public.project_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.project_id = public.current_project_id()
    AND public.is_project_member(m.project_id)
  ORDER BY m.joined_at, u.id;
$$;

REVOKE ALL ON FUNCTION public.list_workspace_members_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_workspace_members_v2() TO authenticated;

COMMIT;
