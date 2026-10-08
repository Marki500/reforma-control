BEGIN;

CREATE TABLE IF NOT EXISTS public.progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  image_url TEXT NOT NULL CHECK (length(trim(image_url)) > 0),
  phase TEXT NOT NULL DEFAULT 'Durante' CHECK (phase IN ('Antes', 'Durante', 'Después')),
  taken_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress photos" ON public.progress_photos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own progress photos" ON public.progress_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = progress_photos.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid()))));
CREATE POLICY "Users can update own progress photos" ON public.progress_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = progress_photos.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid()))));
CREATE POLICY "Users can delete own progress photos" ON public.progress_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX progress_photos_user_date_idx ON public.progress_photos(user_id, taken_date DESC);
CREATE INDEX progress_photos_room_idx ON public.progress_photos(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;

COMMIT;
