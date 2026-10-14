BEGIN;

CREATE TABLE IF NOT EXISTS public.task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task items" ON public.task_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_items.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY "Users can create own task items" ON public.task_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_items.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY "Users can update own task items" ON public.task_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_items.task_id AND tasks.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_items.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY "Users can delete own task items" ON public.task_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_items.task_id AND tasks.user_id = auth.uid()));

CREATE INDEX task_items_task_position_idx ON public.task_items(task_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_items TO authenticated;

COMMIT;
