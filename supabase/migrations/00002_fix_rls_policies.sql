-- Allow users to see shared seed data (user_id IS NULL) AND their own data

DROP POLICY IF EXISTS "Users can view own categories" ON material_categories;
CREATE POLICY "Users can view own categories"
  ON material_categories FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own rooms" ON rooms;
CREATE POLICY "Users can view own rooms"
  ON rooms FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own materials" ON materials;
CREATE POLICY "Users can view own materials"
  ON materials FOR SELECT
  USING (auth.uid() = user_id);
