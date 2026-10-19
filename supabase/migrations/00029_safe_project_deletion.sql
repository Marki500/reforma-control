BEGIN;

-- No foreign key to projects: cleanup must survive a successful project deletion.
CREATE TABLE public.project_file_cleanup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL,
  object_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requested_by, bucket_id, object_name)
);
ALTER TABLE public.project_file_cleanup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pending file cleanup" ON public.project_file_cleanup
  FOR SELECT TO authenticated USING(requested_by = auth.uid());
CREATE POLICY "acknowledge own file cleanup" ON public.project_file_cleanup
  FOR DELETE TO authenticated USING(requested_by = auth.uid());
GRANT SELECT, DELETE ON public.project_file_cleanup TO authenticated;

-- Former project members lose normal file permissions after deletion. Grant only
-- removal of exact objects queued by the transaction, never broad bucket access.
CREATE POLICY "remove queued project files" ON storage.objects FOR DELETE TO authenticated
  USING(EXISTS(SELECT 1 FROM public.project_file_cleanup q
    WHERE q.requested_by = auth.uid() AND q.bucket_id = storage.objects.bucket_id AND q.object_name = storage.objects.name));
-- Storage also requires SELECT permission to locate private objects for removal.
CREATE POLICY "locate queued project files" ON storage.objects FOR SELECT TO authenticated
  USING(EXISTS(SELECT 1 FROM public.project_file_cleanup q
    WHERE q.requested_by = auth.uid() AND q.bucket_id = storage.objects.bucket_id AND q.object_name = storage.objects.name));

-- Keep the original deletion checks as an internal implementation. All public
-- entry points must go through the transactional manifest, including older clients.
ALTER FUNCTION public.delete_project(UUID) RENAME TO delete_project_record;
REVOKE ALL ON FUNCTION public.delete_project_record(UUID) FROM PUBLIC, authenticated;

CREATE FUNCTION public.delete_project_safely(p_project_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_project_member(p_project_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Solo el propietario puede eliminar la reforma';
  END IF;
  -- Lock the project so simultaneous deletion requests cannot queue different work.
  PERFORM 1 FROM projects WHERE id = p_project_id FOR UPDATE;

  WITH references_to_files AS (
    SELECT project_id, 'material-images'::TEXT bucket_id, main_image_url file_url FROM materials
    UNION ALL SELECT project_id, 'images', image_url FROM inspirations
    UNION ALL SELECT project_id, 'images', image_url FROM floor_plans
    UNION ALL SELECT project_id, 'budget-pdfs', file_url FROM budget_pdfs
    UNION ALL SELECT project_id, 'images', image_url FROM progress_photos
    UNION ALL SELECT project_id, 'home-documents', file_url FROM home_documents
  ), matched_objects AS (
    -- Match actual Storage objects, including old-domain links and private paths.
    SELECT DISTINCT r.project_id, o.bucket_id, o.name
    FROM references_to_files r JOIN storage.objects o ON o.bucket_id = r.bucket_id
      AND (r.file_url = o.name OR right(split_part(split_part(r.file_url, '?', 1), '#', 1),
        length('/storage/v1/object/public/' || o.bucket_id || '/' || o.name))
        = '/storage/v1/object/public/' || o.bucket_id || '/' || o.name)
  )
  INSERT INTO project_file_cleanup(requested_by, bucket_id, object_name)
    SELECT auth.uid(), o.bucket_id, o.name FROM matched_objects o
    WHERE o.project_id = p_project_id
      -- Preserve an attachment still referenced by any surviving project.
      AND NOT EXISTS(SELECT 1 FROM matched_objects other
        WHERE other.project_id <> p_project_id AND other.bucket_id = o.bucket_id AND other.name = o.name)
    ON CONFLICT DO NOTHING;

  -- Existing ownership/last-active-project checks and deletion run in this same
  -- transaction. Any failure rolls back BOTH the project and the cleanup queue.
  PERFORM public.delete_project_record(p_project_id);
END$$;
REVOKE ALL ON FUNCTION public.delete_project_safely(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_project_safely(UUID) TO authenticated;

CREATE FUNCTION public.delete_project(p_project_id UUID)
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT public.delete_project_safely(p_project_id)
$$;
REVOKE ALL ON FUNCTION public.delete_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_project(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
