CREATE TABLE IF NOT EXISTS floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Sin título',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own floor plans"
  ON floor_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own floor plans"
  ON floor_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own floor plans"
  ON floor_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own floor plans"
  ON floor_plans FOR DELETE
  USING (auth.uid() = user_id);
