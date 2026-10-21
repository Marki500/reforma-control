BEGIN;
ALTER TABLE public.floor_plans ADD COLUMN IF NOT EXISTS plan_data JSONB;
ALTER TABLE public.floor_plans ADD CONSTRAINT floor_plan_data_shape CHECK (
  plan_data IS NULL OR COALESCE((
    jsonb_typeof(plan_data) = 'object'
    AND plan_data->>'version' = '1'
    AND jsonb_typeof(plan_data->'walls') = 'array'
    AND jsonb_typeof(plan_data->'openings') = 'array'
    AND jsonb_typeof(plan_data->'rooms') = 'array'
    AND octet_length(plan_data::text) <= 1048576
  ), false)
);
-- Existing project RLS policies protect both image and interactive plans.
NOTIFY pgrst, 'reload schema';
COMMIT;
