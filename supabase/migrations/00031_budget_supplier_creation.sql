BEGIN;

ALTER TABLE public.suppliers ADD COLUMN tax_id TEXT NOT NULL DEFAULT '' CHECK(length(tax_id)<=40);
CREATE UNIQUE INDEX suppliers_project_tax_unique ON public.suppliers(project_id, (regexp_replace(upper(tax_id),'[^A-Z0-9]','','g')))
  WHERE regexp_replace(upper(tax_id),'[^A-Z0-9]','','g')<>'';

-- A cancellation also blocks a delayed original request after a lost response.
CREATE TABLE public.budget_supplier_cancellations (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL,
  PRIMARY KEY(project_id,budget_id)
);
ALTER TABLE public.budget_supplier_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project budget cancellation read" ON public.budget_supplier_cancellations FOR SELECT TO authenticated
  USING(project_id=current_project_id() AND is_project_member(project_id));
CREATE POLICY "project budget cancellation write" ON public.budget_supplier_cancellations FOR INSERT TO authenticated
  WITH CHECK(project_id=current_project_id() AND is_project_member(project_id,ARRAY['owner','editor']));
GRANT SELECT,INSERT ON public.budget_supplier_cancellations TO authenticated;

-- Invoker rights retain existing RLS. The project lock serializes supplier
-- resolution in this flow; tax uniqueness also protects other write paths.
CREATE FUNCTION public.create_budget_with_supplier(p_budget JSONB,p_supplier JSONB,p_project UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  target UUID; v_budget_id UUID:=(p_budget->>'id')::UUID; old_budget budget_pdfs%ROWTYPE;
  supplier_name TEXT:=trim(p_supplier->>'name'); tax TEXT:=trim(COALESCE(p_supplier->>'tax_id',''));
  name_key TEXT:=regexp_replace(translate(lower(supplier_name),'áàâäãåāéèêëēíìîïīóòôöõōúùûüūñçýÿ','aaaaaaaeeeeeiiiiioooooouuuuuncyy'),'[^a-z0-9]','','g');
  tax_key TEXT:=regexp_replace(upper(tax),'[^A-Z0-9]','','g'); matches UUID[];
  created BOOLEAN:=false; category UUID:=NULLIF(p_budget->>'category_id','')::UUID;
BEGIN
  IF p_project IS NULL OR p_project IS DISTINCT FROM current_project_id() OR NOT is_project_member(p_project,ARRAY['owner','editor']) THEN
    RAISE EXCEPTION 'No tienes permiso o la reforma activa ha cambiado';
  END IF;
  IF v_budget_id IS NULL THEN RAISE EXCEPTION 'Falta identificar el presupuesto'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('budget-supplier:'||p_project::TEXT,0));
  SELECT * INTO old_budget FROM budget_pdfs WHERE id=v_budget_id;
  IF FOUND THEN
    IF old_budget.project_id IS DISTINCT FROM p_project OR old_budget.file_url IS DISTINCT FROM p_budget->>'file_url' THEN
      RAISE EXCEPTION 'El presupuesto no corresponde a este archivo o reforma';
    END IF;
    RETURN jsonb_build_object('id',old_budget.id,'supplier_id',old_budget.supplier_id,'supplier_created',false);
  END IF;
  IF EXISTS(SELECT 1 FROM budget_supplier_cancellations c WHERE c.project_id=p_project AND c.budget_id=v_budget_id) THEN
    RAISE EXCEPTION 'Este borrador se ha descartado. Comprueba el resultado y prepara un nuevo guardado';
  END IF;
  IF supplier_name IS NULL OR length(supplier_name) NOT BETWEEN 1 AND 200 OR name_key='' OR length(tax)>40
    OR length(COALESCE(p_supplier->>'phone',''))>80 OR length(COALESCE(p_supplier->>'email',''))>200
    OR length(COALESCE(p_supplier->>'address',''))>500 THEN RAISE EXCEPTION 'Revisa los datos del proveedor'; END IF;
  IF NULLIF(p_supplier->>'email','') IS NOT NULL AND p_supplier->>'email' !~ '^\S+@\S+\.\S+$' THEN RAISE EXCEPTION 'Revisa el correo del proveedor'; END IF;
  IF category IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_categories WHERE id=category AND (project_id=p_project OR project_id IS NULL)) THEN
    RAISE EXCEPTION 'La categoría no pertenece a esta reforma';
  END IF;
  IF tax_key<>'' THEN
    SELECT array_agg(id) INTO matches FROM suppliers WHERE project_id=p_project AND regexp_replace(upper(tax_id),'[^A-Z0-9]','','g')=tax_key;
  END IF;
  IF COALESCE(cardinality(matches),0)=0 THEN
    SELECT array_agg(id) INTO matches FROM suppliers WHERE project_id=p_project
      AND regexp_replace(translate(lower(name),'áàâäãåāéèêëēíìîïīóòôöõōúùûüūñçýÿ','aaaaaaaeeeeeiiiiioooooouuuuuncyy'),'[^a-z0-9]','','g')=name_key
      AND NOT(tax_key<>'' AND regexp_replace(upper(tax_id),'[^A-Z0-9]','','g')<>'' AND regexp_replace(upper(tax_id),'[^A-Z0-9]','','g')<>tax_key);
  END IF;
  IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Hay varios proveedores coincidentes. Elige uno de la lista antes de guardar'; END IF;
  target:=matches[1];
  IF target IS NULL THEN
    INSERT INTO suppliers(user_id,project_id,name,tax_id,trade,phone,email,address,status,contacted)
    VALUES(auth.uid(),p_project,supplier_name,tax,'Otro',trim(COALESCE(p_supplier->>'phone','')),trim(COALESCE(p_supplier->>'email','')),trim(COALESCE(p_supplier->>'address','')),'Candidato',false)
    RETURNING id INTO target;
    created:=true;
  END IF;
  INSERT INTO budget_pdfs(id,user_id,project_id,supplier_id,category_id,name,file_url,file_size,notes,total_amount,issued_date,valid_until,status,payment_terms,warranty,quote_number,subtotal,tax_rate,tax_amount,line_items,ai_extracted,ai_model)
  VALUES(v_budget_id,auth.uid(),p_project,target,category,COALESCE(NULLIF(trim(p_budget->>'name'),''),'Presupuesto'),p_budget->>'file_url',(p_budget->>'file_size')::BIGINT,
    COALESCE(p_budget->>'notes',''),NULLIF(p_budget->>'total_amount','')::NUMERIC,NULLIF(p_budget->>'issued_date','')::DATE,NULLIF(p_budget->>'valid_until','')::DATE,
    COALESCE(p_budget->>'status','Recibido'),COALESCE(p_budget->>'payment_terms',''),COALESCE(p_budget->>'warranty',''),COALESCE(p_budget->>'quote_number',''),
    NULLIF(p_budget->>'subtotal','')::NUMERIC,NULLIF(p_budget->>'tax_rate','')::NUMERIC,NULLIF(p_budget->>'tax_amount','')::NUMERIC,
    COALESCE(p_budget->'line_items','[]'::JSONB),COALESCE((p_budget->>'ai_extracted')::BOOLEAN,false),COALESCE(p_budget->>'ai_model',''));
  RETURN jsonb_build_object('id',v_budget_id,'supplier_id',target,'supplier_created',created);
END;
$$;
REVOKE ALL ON FUNCTION public.create_budget_with_supplier(JSONB,JSONB,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_budget_with_supplier(JSONB,JSONB,UUID) TO authenticated;

CREATE FUNCTION public.resolve_budget_supplier_upload(p_id UUID,p_project UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF p_project IS NULL OR p_project IS DISTINCT FROM current_project_id() OR NOT is_project_member(p_project,ARRAY['owner','editor']) THEN
    RAISE EXCEPTION 'No tienes permiso o la reforma activa ha cambiado';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('budget-supplier:'||p_project::TEXT,0));
  IF EXISTS(SELECT 1 FROM budget_pdfs WHERE id=p_id AND project_id=p_project) THEN RETURN jsonb_build_object('saved',true); END IF;
  INSERT INTO budget_supplier_cancellations(project_id,budget_id) VALUES(p_project,p_id) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('saved',false);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_budget_supplier_upload(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_budget_supplier_upload(UUID,UUID) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
