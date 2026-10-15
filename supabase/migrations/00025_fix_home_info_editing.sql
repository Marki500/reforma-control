BEGIN;

CREATE OR REPLACE FUNCTION public.get_home_info()
RETURNS SETOF public.home_info
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT h.*
  FROM public.home_info h
  WHERE h.project_id=public.current_project_id()
    AND public.is_project_member(h.project_id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.save_home_info(p_data JSONB)
RETURNS SETOF public.home_info
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  project UUID:=public.current_project_id();
BEGIN
  IF project IS NULL OR NOT public.is_project_member(project,ARRAY['owner','editor']) THEN
    RAISE EXCEPTION 'No tienes permiso para editar la información de esta vivienda';
  END IF;

  RETURN QUERY
  INSERT INTO public.home_info(
    user_id,project_id,address,postal_code,city,province,property_type,cadastral_reference,
    construction_year,built_area,usable_area,bedrooms,bathrooms,electricity_cups,gas_cups,
    water_contract,habitability_certificate_number,habitability_certificate_date,
    habitability_certificate_expiry,energy_certificate_number,energy_rating,
    energy_certificate_expiry,community_contact,insurance_policy,notes,updated_at
  ) VALUES (
    auth.uid(),project,
    trim(COALESCE(p_data->>'address','')),trim(COALESCE(p_data->>'postal_code','')),
    trim(COALESCE(p_data->>'city','')),trim(COALESCE(p_data->>'province','')),
    trim(COALESCE(p_data->>'property_type','')),upper(trim(COALESCE(p_data->>'cadastral_reference',''))),
    NULLIF(p_data->>'construction_year','')::INTEGER,NULLIF(p_data->>'built_area','')::NUMERIC,
    NULLIF(p_data->>'usable_area','')::NUMERIC,NULLIF(p_data->>'bedrooms','')::INTEGER,
    NULLIF(p_data->>'bathrooms','')::INTEGER,upper(trim(COALESCE(p_data->>'electricity_cups',''))),
    upper(trim(COALESCE(p_data->>'gas_cups',''))),trim(COALESCE(p_data->>'water_contract','')),
    trim(COALESCE(p_data->>'habitability_certificate_number','')),
    NULLIF(p_data->>'habitability_certificate_date','')::DATE,
    NULLIF(p_data->>'habitability_certificate_expiry','')::DATE,
    trim(COALESCE(p_data->>'energy_certificate_number','')),trim(COALESCE(p_data->>'energy_rating','')),
    NULLIF(p_data->>'energy_certificate_expiry','')::DATE,
    trim(COALESCE(p_data->>'community_contact','')),trim(COALESCE(p_data->>'insurance_policy','')),
    trim(COALESCE(p_data->>'notes','')),now()
  )
  ON CONFLICT(project_id) DO UPDATE SET
    user_id=auth.uid(),address=EXCLUDED.address,postal_code=EXCLUDED.postal_code,city=EXCLUDED.city,
    province=EXCLUDED.province,property_type=EXCLUDED.property_type,cadastral_reference=EXCLUDED.cadastral_reference,
    construction_year=EXCLUDED.construction_year,built_area=EXCLUDED.built_area,usable_area=EXCLUDED.usable_area,
    bedrooms=EXCLUDED.bedrooms,bathrooms=EXCLUDED.bathrooms,electricity_cups=EXCLUDED.electricity_cups,
    gas_cups=EXCLUDED.gas_cups,water_contract=EXCLUDED.water_contract,
    habitability_certificate_number=EXCLUDED.habitability_certificate_number,
    habitability_certificate_date=EXCLUDED.habitability_certificate_date,
    habitability_certificate_expiry=EXCLUDED.habitability_certificate_expiry,
    energy_certificate_number=EXCLUDED.energy_certificate_number,energy_rating=EXCLUDED.energy_rating,
    energy_certificate_expiry=EXCLUDED.energy_certificate_expiry,community_contact=EXCLUDED.community_contact,
    insurance_policy=EXCLUDED.insurance_policy,notes=EXCLUDED.notes,updated_at=now()
  RETURNING *;
  PERFORM public.add_project_activity(project,'updated','home_info',NULL,'Actualizó la información de la vivienda');
END$$;

REVOKE ALL ON FUNCTION public.get_home_info(),public.save_home_info(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_info(),public.save_home_info(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
