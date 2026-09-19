-- Only the installation owner invokes initialization or identity linking.
-- Public web routes never infer membership from an email or a display name.
ALTER TABLE club_metadata ADD COLUMN production_initialized BOOLEAN NOT NULL DEFAULT false;

CREATE FUNCTION club_initialize_production(p_input JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE c club_metadata; m members; table_name TEXT; populated BOOLEAN;
 full_name TEXT:=trim(p_input->>'fullName'); display_name TEXT:=trim(p_input->>'displayName');
 subject UUID:=(p_input->>'authSubject')::uuid; zone TEXT:=p_input->>'timeZone';
BEGIN
 PERFORM club_lock(); SELECT * INTO c FROM club_metadata WHERE id=1;
 IF c.mode<>'production' THEN RAISE EXCEPTION 'production_required'; END IF;
 IF c.production_initialized THEN RAISE EXCEPTION 'already_initialized'; END IF;
 IF subject IS NULL OR length(coalesce(full_name,'')) NOT BETWEEN 1 AND 200 OR length(coalesce(display_name,'')) NOT BETWEEN 1 AND 100
 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=zone) THEN RAISE EXCEPTION 'invalid_setup'; END IF;
 FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN('club_metadata','schema_migrations') LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',table_name) INTO populated;
  IF populated THEN RAISE EXCEPTION 'database_not_empty'; END IF;
 END LOOP;
 INSERT INTO members(full_name,display_name,email,role,auth_subject)
 VALUES(full_name,display_name,nullif(trim(p_input->>'email'),''),'admin',subject) RETURNING * INTO m;
 UPDATE club_metadata SET time_zone=zone,production_initialized=true WHERE id=1;
 RETURN jsonb_build_object('memberId',m.id,'instanceId',c.instance_id);
END $$;

CREATE FUNCTION club_link_identity(p_actor UUID,p_member UUID,p_revision INTEGER,p_expected UUID,p_subject UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE m members;
BEGIN
 PERFORM club_lock(); PERFORM club_actor(p_actor,TRUE);
 IF NOT EXISTS(SELECT 1 FROM club_metadata WHERE id=1 AND mode='production' AND production_initialized) THEN RAISE EXCEPTION 'production_required'; END IF;
 SELECT * INTO m FROM members WHERE id=p_member;
 IF m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
 IF m.revision IS DISTINCT FROM p_revision OR m.auth_subject IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_member'; END IF;
 IF m.role='former' AND p_subject IS NOT NULL THEN RAISE EXCEPTION 'active_member_required'; END IF;
 IF m.role='admin' AND p_subject IS NULL AND (SELECT count(*) FROM members WHERE role='admin' AND auth_subject IS NOT NULL)<=1 THEN RAISE EXCEPTION 'last_linked_admin_required'; END IF;
 UPDATE members SET auth_subject=p_subject,revision=revision+1 WHERE id=m.id RETURNING * INTO m;
 RETURN jsonb_build_object('memberId',m.id,'revision',m.revision,'authSubject',m.auth_subject);
END $$;

DO $$ DECLARE signature TEXT; role_name TEXT; BEGIN
 -- Hosted PostgreSQL may have provider defaults granting new tables to browser
 -- roles. Explicitly remove those defaults' effects, including the ledger.
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I',role_name);
  END IF;
 END LOOP;
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,5)='club_' LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',signature);
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I',signature,role_name);END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);END IF;
 END LOOP;
END $$;
