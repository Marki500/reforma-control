BEGIN;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expense_id UUID NOT NULL UNIQUE REFERENCES public.expenses(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  supplier_name TEXT NOT NULL CHECK(length(trim(supplier_name)) BETWEEN 1 AND 200),
  supplier_tax_id TEXT NOT NULL DEFAULT '' CHECK(length(supplier_tax_id)<=40),
  invoice_number TEXT NOT NULL CHECK(length(trim(invoice_number)) BETWEEN 1 AND 100),
  invoice_key TEXT GENERATED ALWAYS AS (regexp_replace(translate(lower(invoice_number),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')) STORED,
  vendor_key TEXT GENERATED ALWAYS AS (regexp_replace(translate(lower(supplier_name),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')) STORED,
  tax_key TEXT GENERATED ALWAYS AS (regexp_replace(upper(supplier_tax_id),'[^A-Z0-9]','','g')) STORED,
  issued_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
  subtotal NUMERIC(12,2) CHECK(subtotal IS NULL OR subtotal>=0),
  tax_rate NUMERIC(6,2) CHECK(tax_rate IS NULL OR tax_rate>=0),
  tax_amount NUMERIC(12,2) CHECK(tax_amount IS NULL OR tax_amount>=0),
  total_amount NUMERIC(12,2) NOT NULL CHECK(total_amount>0),
  file_path TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL CHECK(file_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size BIGINT NOT NULL CHECK(file_size>0 AND file_size<=20971520),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  line_items JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(line_items)='array' AND jsonb_array_length(line_items)<=200),
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(invoice_key<>'' AND vendor_key<>'')
);
CREATE UNIQUE INDEX invoices_vendor_number ON public.invoices(project_id,vendor_key,invoice_key);
CREATE UNIQUE INDEX invoices_tax_number ON public.invoices(project_id,tax_key,invoice_key) WHERE tax_key<>'';
CREATE UNIQUE INDEX invoices_supplier_number ON public.invoices(project_id,supplier_id,invoice_key) WHERE supplier_id IS NOT NULL;
CREATE INDEX invoices_project_date ON public.invoices(project_id,issued_date DESC);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project invoices read" ON public.invoices FOR SELECT TO authenticated
  USING(project_id=public.current_project_id() AND public.is_project_member(project_id));
GRANT SELECT ON public.invoices TO authenticated;
-- Writes only through the validated transactional functions below.
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('invoices','invoices',false,20971520,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=20971520,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE POLICY "read project invoice files" ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='invoices' AND (storage.foldername(name))[1]=public.current_project_id()::TEXT AND public.is_project_member(public.current_project_id()));
CREATE POLICY "upload project invoice files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='invoices' AND (storage.foldername(name))[1]=public.current_project_id()::TEXT AND public.is_project_member(public.current_project_id(),ARRAY['owner','editor']));

CREATE FUNCTION public.register_invoice(p_invoice JSONB,p_expense_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  project UUID:=current_project_id(); invoice_id UUID:=(p_invoice->>'id')::UUID;
  existing invoices%ROWTYPE; target expenses%ROWTYPE; expense UUID;
  supplier UUID:=NULLIF(p_invoice->>'supplier_id','')::UUID;
  room UUID:=NULLIF(p_invoice->>'room_id','')::UUID;
  v_amount NUMERIC:=round((p_invoice->>'total_amount')::NUMERIC,2);
  v_paid NUMERIC:=round(COALESCE(NULLIF(p_invoice->>'paid_amount',''),'0')::NUMERIC,2);
  base NUMERIC:=NULLIF(p_invoice->>'subtotal','')::NUMERIC;
  tax NUMERIC:=NULLIF(p_invoice->>'tax_amount','')::NUMERIC;
  path TEXT:=p_invoice->>'file_path'; mime TEXT:=p_invoice->>'file_type';
BEGIN
  IF project IS NULL OR NOT is_project_member(project,ARRAY['owner','editor']) THEN RAISE EXCEPTION 'No tienes permiso para registrar facturas'; END IF;
  IF invoice_id IS NULL THEN RAISE EXCEPTION 'Falta identificar la factura'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(invoice_id::TEXT,0));
  SELECT * INTO existing FROM invoices WHERE id=invoice_id;
  IF FOUND THEN
    IF existing.project_id<>project THEN RAISE EXCEPTION 'La factura pertenece a otra reforma'; END IF;
    RETURN existing.expense_id; -- Retry after a lost HTTP response cannot duplicate the expense.
  END IF;
  IF COALESCE(p_invoice->>'currency','')<>'EUR' THEN RAISE EXCEPTION 'Solo se registran facturas en EUR, sin conversión automática'; END IF;
  IF v_amount IS NULL OR v_amount<=0 OR v_amount>9999999999.99 OR v_paid<0 OR v_paid>v_amount THEN RAISE EXCEPTION 'Revisa el total y la cantidad pagada'; END IF;
  IF base IS NOT NULL AND tax IS NOT NULL AND abs(base+tax-v_amount)>0.05 THEN RAISE EXCEPTION 'La base imponible más el IVA no coincide con el total'; END IF;
  IF p_invoice->>'category' NOT IN ('Material','Mano de obra','Transporte','Licencia','Otro') OR p_invoice->>'category' IS NULL THEN RAISE EXCEPTION 'Categoría no válida'; END IF;
  IF supplier IS NOT NULL AND NOT EXISTS(SELECT 1 FROM suppliers WHERE id=supplier AND project_id=project) THEN RAISE EXCEPTION 'El proveedor no pertenece a esta reforma'; END IF;
  IF room IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rooms WHERE id=room AND (project_id=project OR project_id IS NULL)) THEN RAISE EXCEPTION 'La estancia no pertenece a esta reforma'; END IF;
  IF path IS NULL OR path NOT IN (project::TEXT||'/'||invoice_id::TEXT||'.pdf',project::TEXT||'/'||invoice_id::TEXT||'.jpg',project::TEXT||'/'||invoice_id::TEXT||'.png',project::TEXT||'/'||invoice_id::TEXT||'.webp') THEN RAISE EXCEPTION 'El archivo no corresponde a esta factura'; END IF;
  IF path IS DISTINCT FROM (project::TEXT||'/'||invoice_id::TEXT||CASE mime WHEN 'application/pdf' THEN '.pdf' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'image/webp' THEN '.webp' ELSE '' END) THEN RAISE EXCEPTION 'El tipo de archivo no coincide con su extensión'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='invoices' AND name=path AND owner=auth.uid()) THEN RAISE EXCEPTION 'No se encuentra el archivo subido'; END IF;
  IF EXISTS(SELECT 1 FROM project_file_cleanup WHERE bucket_id='invoices' AND object_name=path) THEN RAISE EXCEPTION 'Este archivo se ha descartado; vuelve a subirlo'; END IF;

  IF p_expense_id IS NULL THEN
    INSERT INTO expenses(user_id,project_id,title,category,vendor,supplier_id,room_id,budgeted_amount,amount,paid_amount,expense_date,due_date,notes)
    VALUES(auth.uid(),project,trim(p_invoice->>'name'),p_invoice->>'category',trim(p_invoice->>'supplier_name'),supplier,room,0,v_amount,v_paid,(p_invoice->>'issued_date')::DATE,NULLIF(p_invoice->>'due_date','')::DATE,COALESCE(p_invoice->>'notes','')) RETURNING id INTO expense;
  ELSE
    SELECT * INTO target FROM expenses WHERE id=p_expense_id AND project_id=project FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El gasto no pertenece a esta reforma'; END IF;
    IF EXISTS(SELECT 1 FROM invoices WHERE expense_id=target.id) THEN RAISE EXCEPTION 'Ese gasto ya tiene una factura vinculada'; END IF;
    IF p_invoice->>'expected_paid_amount' IS NULL OR (p_invoice->>'expected_paid_amount')::NUMERIC IS DISTINCT FROM target.paid_amount THEN
      RAISE EXCEPTION 'Los pagos de ese gasto han cambiado. Actualiza la lista y revisa de nuevo antes de vincular la factura';
    END IF;
    UPDATE expenses SET title=trim(p_invoice->>'name'),category=p_invoice->>'category',vendor=trim(p_invoice->>'supplier_name'),supplier_id=supplier,room_id=room,
      amount=v_amount,paid_amount=v_paid,expense_date=(p_invoice->>'issued_date')::DATE,due_date=NULLIF(p_invoice->>'due_date','')::DATE,updated_at=now()
      WHERE id=target.id RETURNING id INTO expense;
  END IF;

  INSERT INTO invoices(id,project_id,user_id,expense_id,supplier_id,name,supplier_name,supplier_tax_id,invoice_number,issued_date,currency,subtotal,tax_rate,tax_amount,total_amount,file_path,file_type,file_size,notes,line_items,ai_extracted,ai_model)
  VALUES(invoice_id,project,auth.uid(),expense,supplier,trim(p_invoice->>'name'),trim(p_invoice->>'supplier_name'),trim(COALESCE(p_invoice->>'supplier_tax_id','')),trim(p_invoice->>'invoice_number'),(p_invoice->>'issued_date')::DATE,'EUR',base,NULLIF(p_invoice->>'tax_rate','')::NUMERIC,tax,v_amount,path,mime,(p_invoice->>'file_size')::BIGINT,COALESCE(p_invoice->>'notes',''),COALESCE(p_invoice->'line_items','[]'),COALESCE((p_invoice->>'ai_extracted')::BOOLEAN,false),left(COALESCE(p_invoice->>'ai_model',''),200));
  RETURN expense;
END$$;

-- A registered invoice fixes the invoiced amount. Payments, dates, categories and
-- notes remain editable in Expenses; deleting the invoice keeps the expense.
CREATE FUNCTION public.protect_invoiced_amount() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount AND EXISTS(SELECT 1 FROM invoices WHERE expense_id=OLD.id) THEN RAISE EXCEPTION 'El importe está vinculado a una factura. Retira la factura antes de corregirlo'; END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER protect_invoiced_amount BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.protect_invoiced_amount();
CREATE TRIGGER project_activity_change AFTER INSERT OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.log_project_row_change();

CREATE FUNCTION public.delete_invoice(p_invoice_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item invoices%ROWTYPE;
BEGIN
  SELECT * INTO item FROM invoices WHERE id=p_invoice_id AND project_id=current_project_id() FOR UPDATE;
  IF NOT FOUND OR NOT is_project_member(item.project_id,ARRAY['owner','editor']) THEN RAISE EXCEPTION 'No tienes permiso para retirar esta factura'; END IF;
  INSERT INTO project_file_cleanup(requested_by,bucket_id,object_name) VALUES(auth.uid(),'invoices',item.file_path) ON CONFLICT DO NOTHING;
  DELETE FROM invoices WHERE id=item.id;
END$$;

CREATE FUNCTION public.discard_invoice_upload(p_invoice_id UUID,p_path TEXT) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project UUID:=current_project_id();
BEGIN
  IF NOT is_project_member(project,ARRAY['owner','editor']) THEN RAISE EXCEPTION 'No tienes permiso para descartar el archivo'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_invoice_id::TEXT,0));
  IF EXISTS(SELECT 1 FROM invoices WHERE id=p_invoice_id OR file_path=p_path) THEN RETURN; END IF;
  IF p_path NOT IN(project::TEXT||'/'||p_invoice_id::TEXT||'.pdf',project::TEXT||'/'||p_invoice_id::TEXT||'.jpg',project::TEXT||'/'||p_invoice_id::TEXT||'.png',project::TEXT||'/'||p_invoice_id::TEXT||'.webp') THEN RAISE EXCEPTION 'Archivo no válido'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='invoices' AND name=p_path AND owner=auth.uid()) THEN
    INSERT INTO project_file_cleanup(requested_by,bucket_id,object_name) VALUES(auth.uid(),'invoices',p_path) ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Queue invoice files before the existing project deletion cascades into invoices.
CREATE FUNCTION public.queue_project_invoice_files() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND is_project_member(OLD.id,ARRAY['owner']) THEN
    INSERT INTO project_file_cleanup(requested_by,bucket_id,object_name) SELECT auth.uid(),'invoices',file_path FROM invoices WHERE project_id=OLD.id ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END$$;
CREATE TRIGGER queue_project_invoice_files BEFORE DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.queue_project_invoice_files();

REVOKE ALL ON FUNCTION public.register_invoice(JSONB,UUID),public.delete_invoice(UUID),public.discard_invoice_upload(UUID,TEXT),public.protect_invoiced_amount(),public.queue_project_invoice_files() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_invoice(JSONB,UUID),public.delete_invoice(UUID),public.discard_invoice_upload(UUID,TEXT) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
