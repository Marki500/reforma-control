BEGIN;
ALTER TABLE public.expenses ADD COLUMN payer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX expenses_payer_user_idx ON public.expenses(project_id, payer_user_id);
CREATE FUNCTION public.validate_expense_payer() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.payer_user_id IS NOT DISTINCT FROM OLD.payer_user_id AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN RETURN NEW; END IF;
  END IF;
  IF NEW.payer_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id=NEW.project_id AND user_id=NEW.payer_user_id
  ) THEN RAISE EXCEPTION 'La persona que paga debe ser miembro del proyecto'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_expense_payer BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.validate_expense_payer();
COMMIT;
