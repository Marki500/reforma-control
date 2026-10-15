BEGIN;

CREATE OR REPLACE FUNCTION public.create_project(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project UUID;
  clean_name TEXT := trim(p_name);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  IF clean_name = '' OR length(clean_name) > 80 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 1 y 80 caracteres';
  END IF;

  INSERT INTO projects (owner_id, name)
  VALUES (auth.uid(), clean_name)
  RETURNING id INTO project;

  INSERT INTO project_members (project_id, user_id, role, joined_at)
  VALUES (project, auth.uid(), 'owner', now());

  INSERT INTO user_active_projects (user_id, project_id, updated_at)
  VALUES (auth.uid(), project, now())
  ON CONFLICT (user_id) DO UPDATE
  SET project_id = EXCLUDED.project_id, updated_at = now();

  RETURN project;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_project(p_project_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_name TEXT := trim(p_name);
BEGIN
  IF NOT public.is_project_member(p_project_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Solo el propietario puede editar la reforma';
  END IF;

  IF clean_name = '' OR length(clean_name) > 80 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 1 y 80 caracteres';
  END IF;

  UPDATE projects
  SET name = clean_name, updated_at = now()
  WHERE id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_project(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_project(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
