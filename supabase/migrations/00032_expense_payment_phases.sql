BEGIN;
ALTER TABLE public.expenses
  ADD COLUMN payment_phases JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN payment_plan_version INTEGER NOT NULL DEFAULT 0;

CREATE FUNCTION public.guard_expense_payment_phases() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  phase JSONB; planned NUMERIC:=0; paid NUMERIC:=0; next_due DATE; value NUMERIC;
  phase_id UUID; ids UUID[]:=ARRAY[]::UUID[]; due DATE; paid_date DATE; dirty BOOLEAN:=false;
BEGIN
  IF jsonb_typeof(NEW.payment_phases) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.payment_phases)>50 THEN RAISE EXCEPTION 'El plan debe contener entre 0 y 50 fases'; END IF;
  IF TG_OP='UPDATE' THEN
    dirty:=NEW.payment_phases IS DISTINCT FROM OLD.payment_phases OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount;
    IF dirty AND NEW.payment_plan_version IS DISTINCT FROM OLD.payment_plan_version THEN
      RAISE EXCEPTION 'Los pagos han cambiado desde que abriste este gasto. Actualiza la lista y revisa de nuevo' USING ERRCODE='40001';
    END IF;
    IF jsonb_array_length(OLD.payment_phases)>0 AND NEW.payment_phases=OLD.payment_phases AND NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
      RAISE EXCEPTION 'Este gasto tiene pagos por fases. Registra o corrige el pago desde sus fases en Gastos';
    END IF;
  END IF;
  FOR phase IN SELECT * FROM jsonb_array_elements(NEW.payment_phases) LOOP
    IF jsonb_typeof(phase) IS DISTINCT FROM 'object' OR length(trim(COALESCE(phase->>'title',''))) NOT BETWEEN 1 AND 120 OR jsonb_typeof(phase->'paid') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Revisa el nombre y el estado de cada fase'; END IF;
    phase_id:=(phase->>'id')::UUID;
    IF phase_id IS NULL OR phase_id=ANY(ids) THEN RAISE EXCEPTION 'Cada fase debe tener un identificador distinto'; END IF;
    ids:=array_append(ids,phase_id);
    value:=(phase->>'amount')::NUMERIC;
    IF value IS NULL OR NOT(value>0 AND value<=9999999999.99) OR value<>round(value,2) THEN RAISE EXCEPTION 'El importe de cada fase debe ser positivo y tener como máximo dos decimales'; END IF;
    due:=NULLIF(phase->>'due_date','')::DATE;
    paid_date:=NULLIF(phase->>'paid_date','')::DATE;
    IF paid_date IS NOT NULL AND (NOT (phase->>'paid')::BOOLEAN OR paid_date>(now() AT TIME ZONE 'Europe/Madrid')::DATE) THEN RAISE EXCEPTION 'Revisa la fecha del pago realizado'; END IF;
    planned:=planned+value;
    IF (phase->>'paid')::BOOLEAN THEN paid:=paid+value;
    ELSE next_due:=LEAST(next_due,due); END IF;
  END LOOP;
  IF jsonb_array_length(NEW.payment_phases)>0 THEN
    IF planned IS DISTINCT FROM NEW.amount THEN RAISE EXCEPTION 'La suma de las fases debe coincidir con el coste final del gasto'; END IF;
    NEW.paid_amount:=paid;
    NEW.due_date:=next_due;
  END IF;
  IF TG_OP='INSERT' THEN NEW.payment_plan_version:=0;
  ELSE NEW.payment_plan_version:=OLD.payment_plan_version+CASE WHEN dirty THEN 1 ELSE 0 END; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_expense_payment_phases BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_expense_payment_phases();
NOTIFY pgrst,'reload schema';
COMMIT;
