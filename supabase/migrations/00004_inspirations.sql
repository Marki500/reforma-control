-- Inspiration board

CREATE TABLE IF NOT EXISTS inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inspirations"
  ON inspirations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inspirations"
  ON inspirations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inspirations"
  ON inspirations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own inspirations"
  ON inspirations FOR DELETE
  USING (auth.uid() = user_id);
