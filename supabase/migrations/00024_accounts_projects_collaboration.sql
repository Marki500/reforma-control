BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','in_progress','completed','archived')),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS target_end_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(14,2) CHECK (estimated_budget IS NULL OR estimated_budget >= 0),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT false;

UPDATE public.projects SET setup_completed = true WHERE setup_completed = false;

CREATE TABLE IF NOT EXISTS public.project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_activity_project_date_idx ON public.project_activity(project_id, created_at DESC);
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project activity read" ON public.project_activity;
CREATE POLICY "project activity read" ON public.project_activity FOR SELECT TO authenticated USING(public.is_project_member(project_id));
GRANT SELECT ON public.project_activity TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_comments_project_date_idx ON public.project_comments(project_id,created_at DESC);
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project comments read" ON public.project_comments;
CREATE POLICY "project comments read" ON public.project_comments FOR SELECT TO authenticated USING(public.is_project_member(project_id));
GRANT SELECT ON public.project_comments TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_notification_preferences (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_comments BOOLEAN NOT NULL DEFAULT false,
  email_mentions BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,user_id)
);
ALTER TABLE public.project_notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notification preferences" ON public.project_notification_preferences;
CREATE POLICY "own notification preferences" ON public.project_notification_preferences FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_project_member(project_id));
GRANT SELECT ON public.project_notification_preferences TO authenticated;

CREATE OR REPLACE FUNCTION public.add_project_activity(p_project UUID,p_action TEXT,p_entity_type TEXT,p_entity_id UUID,p_summary TEXT,p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_project_member(p_project) THEN RETURN; END IF;
  INSERT INTO project_activity(project_id,actor_id,action,entity_type,entity_id,summary,metadata)
  VALUES(p_project,auth.uid(),p_action,p_entity_type,p_entity_id,left(p_summary,240),COALESCE(p_metadata,'{}'::jsonb));
END$$;

CREATE OR REPLACE FUNCTION public.log_project_row_change() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_data JSONB:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
DECLARE label TEXT:=COALESCE(row_data->>'title',row_data->>'name','Elemento');
DECLARE action_name TEXT:=lower(TG_OP);
BEGIN
  IF auth.uid() IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  PERFORM add_project_activity((row_data->>'project_id')::UUID,action_name,TG_TABLE_NAME,(row_data->>'id')::UUID,
    CASE TG_OP WHEN 'INSERT' THEN 'Añadió '||label WHEN 'UPDATE' THEN 'Actualizó '||label ELSE 'Eliminó '||label END,
    jsonb_build_object('label',label));
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END$$;

DO $$DECLARE table_name TEXT;BEGIN
  FOREACH table_name IN ARRAY ARRAY['tasks','budget_pdfs','expenses','suppliers'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS project_activity_change ON public.%I',table_name);
    EXECUTE format('CREATE TRIGGER project_activity_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_project_row_change()',table_name);
  END LOOP;
END$$;

CREATE OR REPLACE FUNCTION public.list_user_projects_v2()
RETURNS TABLE(project_id UUID,name TEXT,role TEXT,is_active BOOLEAN,status TEXT,address TEXT,start_date DATE,target_end_date DATE,estimated_budget NUMERIC,archived_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id,p.name,m.role,p.id=current_project_id(),p.status,p.address,p.start_date,p.target_end_date,p.estimated_budget,p.archived_at
  FROM projects p JOIN project_members m ON m.project_id=p.id
  WHERE m.user_id=auth.uid()
  ORDER BY (p.archived_at IS NOT NULL),p.updated_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_project_details()
RETURNS TABLE(project_id UUID,name TEXT,description TEXT,address TEXT,status TEXT,start_date DATE,target_end_date DATE,estimated_budget NUMERIC,archived_at TIMESTAMPTZ,setup_completed BOOLEAN,role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id,p.name,p.description,p.address,p.status,p.start_date,p.target_end_date,p.estimated_budget,p.archived_at,p.setup_completed,m.role
  FROM projects p JOIN project_members m ON m.project_id=p.id AND m.user_id=auth.uid()
  WHERE p.id=current_project_id()
$$;

CREATE OR REPLACE FUNCTION public.update_project_details(p_name TEXT,p_description TEXT DEFAULT '',p_address TEXT DEFAULT '',p_status TEXT DEFAULT 'planning',p_start_date DATE DEFAULT NULL,p_target_end_date DATE DEFAULT NULL,p_estimated_budget NUMERIC DEFAULT NULL,p_setup_completed BOOLEAN DEFAULT true)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project UUID:=current_project_id();clean_name TEXT:=trim(p_name);
BEGIN
  IF NOT is_project_member(project,ARRAY['owner','editor']) THEN RAISE EXCEPTION 'No tienes permiso para editar la reforma';END IF;
  IF clean_name='' OR length(clean_name)>80 THEN RAISE EXCEPTION 'El nombre debe tener entre 1 y 80 caracteres';END IF;
  IF p_status NOT IN('planning','in_progress','completed') THEN RAISE EXCEPTION 'Estado no válido';END IF;
  IF p_target_end_date IS NOT NULL AND p_start_date IS NOT NULL AND p_target_end_date<p_start_date THEN RAISE EXCEPTION 'La fecha final no puede ser anterior a la inicial';END IF;
  UPDATE projects SET name=clean_name,description=left(COALESCE(p_description,''),1000),address=left(COALESCE(p_address,''),300),status=p_status,start_date=p_start_date,target_end_date=p_target_end_date,estimated_budget=p_estimated_budget,setup_completed=p_setup_completed,updated_at=now() WHERE id=project;
  PERFORM add_project_activity(project,'updated','project',project,'Actualizó los datos de la reforma');
END$$;

CREATE OR REPLACE FUNCTION public.duplicate_project(p_project_id UUID,p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source projects%ROWTYPE;created UUID;clean_name TEXT:=trim(p_name);
BEGIN
  IF NOT is_project_member(p_project_id) THEN RAISE EXCEPTION 'No tienes acceso a esta reforma';END IF;
  IF clean_name='' OR length(clean_name)>80 THEN RAISE EXCEPTION 'El nombre debe tener entre 1 y 80 caracteres';END IF;
  SELECT * INTO source FROM projects WHERE id=p_project_id;
  INSERT INTO projects(owner_id,name,description,address,status,start_date,target_end_date,estimated_budget,setup_completed)
  VALUES(auth.uid(),clean_name,source.description,source.address,'planning',NULL,NULL,source.estimated_budget,true) RETURNING id INTO created;
  INSERT INTO project_members VALUES(created,auth.uid(),'owner',now());
  INSERT INTO material_categories(user_id,name,description,project_id) SELECT auth.uid(),name,description,created FROM material_categories WHERE project_id=p_project_id;
  INSERT INTO rooms(user_id,name,description,project_id) SELECT auth.uid(),name,description,created FROM rooms WHERE project_id=p_project_id;
  INSERT INTO user_active_projects VALUES(auth.uid(),created,now()) ON CONFLICT(user_id) DO UPDATE SET project_id=EXCLUDED.project_id,updated_at=now();
  PERFORM add_project_activity(created,'created','project',created,'Creó la reforma a partir de una plantilla');
  RETURN created;
END$$;

CREATE OR REPLACE FUNCTION public.archive_project(p_project_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE alternative UUID;
BEGIN
  IF NOT is_project_member(p_project_id,ARRAY['owner']) THEN RAISE EXCEPTION 'Solo el propietario puede archivar la reforma';END IF;
  SELECT p.id INTO alternative FROM projects p JOIN project_members m ON m.project_id=p.id WHERE m.user_id=auth.uid() AND p.id<>p_project_id AND p.archived_at IS NULL ORDER BY p.updated_at DESC LIMIT 1;
  IF alternative IS NULL THEN RAISE EXCEPTION 'Crea otra reforma antes de archivar esta';END IF;
  UPDATE projects SET status='archived',archived_at=now(),updated_at=now() WHERE id=p_project_id;
  INSERT INTO user_active_projects VALUES(auth.uid(),alternative,now()) ON CONFLICT(user_id) DO UPDATE SET project_id=EXCLUDED.project_id,updated_at=now();
END$$;

CREATE OR REPLACE FUNCTION public.restore_project(p_project_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT is_project_member(p_project_id,ARRAY['owner']) THEN RAISE EXCEPTION 'Solo el propietario puede restaurar la reforma';END IF;
  UPDATE projects SET status='planning',archived_at=NULL,updated_at=now() WHERE id=p_project_id;
END$$;

CREATE OR REPLACE FUNCTION public.delete_project(p_project_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE alternative UUID;
BEGIN
  IF NOT is_project_member(p_project_id,ARRAY['owner']) THEN RAISE EXCEPTION 'Solo el propietario puede eliminar la reforma';END IF;
  SELECT p.id INTO alternative FROM projects p JOIN project_members m ON m.project_id=p.id WHERE m.user_id=auth.uid() AND p.id<>p_project_id AND p.archived_at IS NULL ORDER BY p.updated_at DESC LIMIT 1;
  IF alternative IS NULL THEN RAISE EXCEPTION 'Debes conservar al menos una reforma activa';END IF;
  DELETE FROM projects WHERE id=p_project_id;
  INSERT INTO user_active_projects VALUES(auth.uid(),alternative,now()) ON CONFLICT(user_id) DO UPDATE SET project_id=EXCLUDED.project_id,updated_at=now();
END$$;

CREATE OR REPLACE FUNCTION public.update_project_member_role(p_user_id UUID,p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project UUID:=current_project_id();member_email TEXT;
BEGIN
  IF NOT is_project_member(project,ARRAY['owner']) THEN RAISE EXCEPTION 'Solo el propietario puede cambiar permisos';END IF;
  IF p_role NOT IN('editor','viewer') THEN RAISE EXCEPTION 'Rol no válido';END IF;
  UPDATE project_members SET role=p_role WHERE project_id=project AND user_id=p_user_id AND role<>'owner';
  SELECT COALESCE(email::TEXT,'esta persona') INTO member_email FROM auth.users WHERE id=p_user_id;
  PERFORM add_project_activity(project,'role_changed','member',p_user_id,'Cambió los permisos de '||member_email,jsonb_build_object('role',p_role));
END$$;

CREATE OR REPLACE FUNCTION public.list_project_activity(p_limit INTEGER DEFAULT 30)
RETURNS TABLE(id UUID,actor_email TEXT,action TEXT,entity_type TEXT,summary TEXT,metadata JSONB,created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,auth AS $$
  SELECT a.id,COALESCE(u.email::TEXT,'Usuario eliminado'),a.action,a.entity_type,a.summary,a.metadata,a.created_at
  FROM project_activity a LEFT JOIN auth.users u ON u.id=a.actor_id
  WHERE a.project_id=current_project_id() AND is_project_member(a.project_id)
  ORDER BY a.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100)
$$;

CREATE OR REPLACE FUNCTION public.list_project_comments(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(id UUID,author_id UUID,author_email TEXT,body TEXT,created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,auth AS $$
  SELECT c.id,c.author_id,COALESCE(u.email::TEXT,'Usuario eliminado'),c.body,c.created_at
  FROM project_comments c LEFT JOIN auth.users u ON u.id=c.author_id
  WHERE c.project_id=current_project_id() AND is_project_member(c.project_id)
  ORDER BY c.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100)
$$;

CREATE OR REPLACE FUNCTION public.create_project_comment(p_body TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project UUID:=current_project_id();created UUID;clean_body TEXT:=trim(p_body);
BEGIN
  IF NOT is_project_member(project) THEN RAISE EXCEPTION 'No tienes acceso a esta reforma';END IF;
  IF length(clean_body)<1 OR length(clean_body)>2000 THEN RAISE EXCEPTION 'El comentario debe tener entre 1 y 2000 caracteres';END IF;
  INSERT INTO project_comments(project_id,author_id,body) VALUES(project,auth.uid(),clean_body) RETURNING id INTO created;
  PERFORM add_project_activity(project,'commented','comment',created,'Añadió un comentario');
  RETURN created;
END$$;

CREATE OR REPLACE FUNCTION public.delete_project_comment(p_comment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project UUID:=current_project_id();
BEGIN
  DELETE FROM project_comments WHERE id=p_comment_id AND project_id=project AND (author_id=auth.uid() OR is_project_member(project,ARRAY['owner']));
END$$;

CREATE OR REPLACE FUNCTION public.get_project_notification_preferences()
RETURNS TABLE(email_comments BOOLEAN,email_mentions BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(p.email_comments,false),COALESCE(p.email_mentions,true)
  FROM (SELECT 1) seed LEFT JOIN project_notification_preferences p ON p.project_id=current_project_id() AND p.user_id=auth.uid()
  WHERE is_project_member(current_project_id())
$$;

CREATE OR REPLACE FUNCTION public.update_project_notification_preferences(p_email_comments BOOLEAN,p_email_mentions BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project UUID:=current_project_id();
BEGIN
  IF NOT is_project_member(project) THEN RAISE EXCEPTION 'No tienes acceso a esta reforma';END IF;
  INSERT INTO project_notification_preferences(project_id,user_id,email_comments,email_mentions,updated_at)
  VALUES(project,auth.uid(),p_email_comments,p_email_mentions,now())
  ON CONFLICT(project_id,user_id) DO UPDATE SET email_comments=EXCLUDED.email_comments,email_mentions=EXCLUDED.email_mentions,updated_at=now();
END$$;

CREATE OR REPLACE FUNCTION public.get_comment_notification_recipients(p_comment_id UUID)
RETURNS TABLE(email TEXT,mentioned BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,auth AS $$
  SELECT u.email::TEXT,position('@'||lower(u.email::TEXT) IN lower(c.body))>0
  FROM project_comments c
  JOIN project_members m ON m.project_id=c.project_id AND m.user_id<>auth.uid()
  JOIN auth.users u ON u.id=m.user_id
  LEFT JOIN project_notification_preferences p ON p.project_id=c.project_id AND p.user_id=m.user_id
  WHERE c.id=p_comment_id AND c.author_id=auth.uid() AND is_project_member(c.project_id)
    AND (COALESCE(p.email_comments,false) OR (COALESCE(p.email_mentions,true) AND position('@'||lower(u.email::TEXT) IN lower(c.body))>0))
$$;

REVOKE ALL ON FUNCTION public.add_project_activity(UUID,TEXT,TEXT,UUID,TEXT,JSONB),public.log_project_row_change(),public.list_user_projects_v2(),public.get_project_details(),public.update_project_details(TEXT,TEXT,TEXT,TEXT,DATE,DATE,NUMERIC,BOOLEAN),public.duplicate_project(UUID,TEXT),public.archive_project(UUID),public.restore_project(UUID),public.delete_project(UUID),public.update_project_member_role(UUID,TEXT),public.list_project_activity(INTEGER),public.list_project_comments(INTEGER),public.create_project_comment(TEXT),public.delete_project_comment(UUID),public.get_project_notification_preferences(),public.update_project_notification_preferences(BOOLEAN,BOOLEAN),public.get_comment_notification_recipients(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_projects_v2(),public.get_project_details(),public.update_project_details(TEXT,TEXT,TEXT,TEXT,DATE,DATE,NUMERIC,BOOLEAN),public.duplicate_project(UUID,TEXT),public.archive_project(UUID),public.restore_project(UUID),public.delete_project(UUID),public.update_project_member_role(UUID,TEXT),public.list_project_activity(INTEGER),public.list_project_comments(INTEGER),public.create_project_comment(TEXT),public.delete_project_comment(UUID),public.get_project_notification_preferences(),public.update_project_notification_preferences(BOOLEAN,BOOLEAN),public.get_comment_notification_recipients(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
