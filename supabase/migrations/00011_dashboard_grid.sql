-- Dashboard budget grid configuration

CREATE TABLE IF NOT EXISTS dashboard_grid_config (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  num_columns INT NOT NULL DEFAULT 3,
  num_rows INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard_grid_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
  budget_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  row_index INT NOT NULL,
  col_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, row_index, col_index)
);

ALTER TABLE dashboard_grid_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_grid_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grid config"
  ON dashboard_grid_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grid config"
  ON dashboard_grid_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grid config"
  ON dashboard_grid_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grid config"
  ON dashboard_grid_config FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own grid cells"
  ON dashboard_grid_cells FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grid cells"
  ON dashboard_grid_cells FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grid cells"
  ON dashboard_grid_cells FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grid cells"
  ON dashboard_grid_cells FOR DELETE
  USING (auth.uid() = user_id);
