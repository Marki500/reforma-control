BEGIN;
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En curso', 'Completada')),
  priority TEXT NOT NULL DEFAULT 'Media' CHECK (priority IN ('Baja', 'Media', 'Alta', 'Urgente')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = tasks.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid()))));
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = tasks.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid()))));
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX tasks_user_due_date_idx ON public.tasks(user_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
COMMIT;
