BEGIN;

CREATE OR REPLACE FUNCTION public.get_ai_usage_status()
RETURNS TABLE(allowed BOOLEAN,reason TEXT,user_used INTEGER,user_limit INTEGER,global_used BIGINT,global_limit INTEGER,usage_date DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_date DATE:=(timezone('Europe/Madrid',now()))::DATE;
  v_user_used INTEGER:=0;
  v_global_used BIGINT:=0;
  v_user_limit CONSTANT INTEGER:=10;
  v_global_limit CONSTANT INTEGER:=40;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false,'unauthenticated',0,v_user_limit,0::BIGINT,v_global_limit,v_date;
    RETURN;
  END IF;
  SELECT COALESCE((SELECT d.request_count FROM ai_usage_daily d WHERE d.usage_date=v_date AND d.user_id=auth.uid()),0) INTO v_user_used;
  SELECT COALESCE(sum(d.request_count),0) INTO v_global_used FROM ai_usage_daily d WHERE d.usage_date=v_date;
  RETURN QUERY SELECT v_user_used<v_user_limit AND v_global_used<v_global_limit,
    CASE WHEN v_user_used>=v_user_limit THEN 'user_limit' WHEN v_global_used>=v_global_limit THEN 'global_limit' ELSE 'available' END,
    v_user_used,v_user_limit,v_global_used,v_global_limit,v_date;
END$$;

CREATE OR REPLACE FUNCTION public.reserve_ai_usage()
RETURNS TABLE(allowed BOOLEAN,reason TEXT,user_used INTEGER,user_limit INTEGER,global_used BIGINT,global_limit INTEGER,usage_date DATE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_date DATE:=(timezone('Europe/Madrid',now()))::DATE;
  v_user_used INTEGER:=0;
  v_global_used BIGINT:=0;
  v_user_limit CONSTANT INTEGER:=10;
  v_global_limit CONSTANT INTEGER:=40;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false,'unauthenticated',0,v_user_limit,0::BIGINT,v_global_limit,v_date;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('nivel-ai-usage-'||v_date::TEXT));
  SELECT COALESCE((SELECT d.request_count FROM ai_usage_daily d WHERE d.usage_date=v_date AND d.user_id=auth.uid()),0) INTO v_user_used;
  SELECT COALESCE(sum(d.request_count),0) INTO v_global_used FROM ai_usage_daily d WHERE d.usage_date=v_date;
  IF v_user_used>=v_user_limit THEN
    RETURN QUERY SELECT false,'user_limit',v_user_used,v_user_limit,v_global_used,v_global_limit,v_date;
    RETURN;
  END IF;
  IF v_global_used>=v_global_limit THEN
    RETURN QUERY SELECT false,'global_limit',v_user_used,v_user_limit,v_global_used,v_global_limit,v_date;
    RETURN;
  END IF;
  INSERT INTO ai_usage_daily(usage_date,user_id,request_count,updated_at) VALUES(v_date,auth.uid(),1,now())
  ON CONFLICT ON CONSTRAINT ai_usage_daily_pkey DO UPDATE SET request_count=ai_usage_daily.request_count+1,updated_at=now()
  RETURNING ai_usage_daily.request_count INTO v_user_used;
  v_global_used:=v_global_used+1;
  RETURN QUERY SELECT true,'reserved',v_user_used,v_user_limit,v_global_used,v_global_limit,v_date;
END$$;

REVOKE ALL ON FUNCTION public.get_ai_usage_status(),public.reserve_ai_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_usage_status(),public.reserve_ai_usage() TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
