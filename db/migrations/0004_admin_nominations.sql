ALTER TABLE books ADD COLUMN audiobook_length TEXT;

CREATE FUNCTION club_create_member(p_actor UUID,p_input JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE m members; full_name TEXT:=trim(p_input->>'fullName'); display_name TEXT:=trim(p_input->>'displayName'); role_name TEXT:=coalesce(p_input->>'role','member');
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 IF full_name IS NULL OR length(full_name)<1 OR length(full_name)>200 OR length(coalesce(display_name,''))>100 OR role_name NOT IN('admin','member') THEN RAISE EXCEPTION 'invalid_member'; END IF;
 INSERT INTO members(full_name,display_name,email,role) VALUES(full_name,coalesce(nullif(display_name,''),full_name),nullif(trim(p_input->>'email'),''),role_name) RETURNING * INTO m;
 RETURN jsonb_build_object('id',m.id,'revision',m.revision);
END $$;

CREATE FUNCTION club_update_member(p_actor UUID,p_member UUID,p_expected INTEGER,p_role TEXT,p_reminder_exempt BOOLEAN DEFAULT NULL) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE m members;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 SELECT * INTO m FROM members WHERE id=p_member;
 IF m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
 IF m.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_member'; END IF;
 IF p_role IS NULL OR p_role NOT IN('admin','member','former') THEN RAISE EXCEPTION 'invalid_role'; END IF;
 IF p_actor=p_member AND p_role<>'admin' THEN RAISE EXCEPTION 'cannot_demote_yourself'; END IF;
 IF m.role='admin' AND p_role<>'admin' AND (SELECT count(*) FROM members WHERE role='admin')<=1 THEN RAISE EXCEPTION 'last_admin_required'; END IF;
 UPDATE members SET role=p_role,reminder_exempt=coalesce(p_reminder_exempt,reminder_exempt),revision=revision+1 WHERE id=m.id RETURNING * INTO m;
 RETURN jsonb_build_object('id',m.id,'revision',m.revision,'role',m.role);
END $$;

CREATE FUNCTION club_update_meeting_notes(p_actor UUID,p_meeting UUID,p_expected INTEGER,p_notes TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE m meetings;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 SELECT * INTO m FROM meetings WHERE id=p_meeting;
 IF m.id IS NULL THEN RAISE EXCEPTION 'meeting_not_found'; END IF;
 IF m.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_meeting'; END IF;
 IF p_notes IS NULL OR length(p_notes)>20000 THEN RAISE EXCEPTION 'invalid_notes'; END IF;
 UPDATE meetings SET notes=nullif(trim(p_notes),''),revision=revision+1 WHERE id=m.id RETURNING * INTO m;
 RETURN jsonb_build_object('revision',m.revision,'notes',m.notes);
END $$;

CREATE FUNCTION club_nominate(p_actor UUID,p_input JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE b books; nomination UUID; queued BOOLEAN; v_title TEXT:=trim(p_input->>'title'); v_author TEXT:=trim(p_input->>'author'); pages INTEGER:=(p_input->>'pageCount')::integer; rating NUMERIC:=(p_input->>'goodreadsRating')::numeric;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor);
 IF v_title IS NULL OR length(v_title)<1 OR length(v_title)>300 OR v_author IS NULL OR length(v_author)<1 OR length(v_author)>200 OR pages<=0 OR rating<0 OR rating>5 OR length(coalesce(p_input->>'description',''))>2000 OR length(coalesce(p_input->>'audiobookLength',''))>100 OR length(coalesce(p_input->>'notes',''))>4000 THEN RAISE EXCEPTION 'invalid_nomination'; END IF;
 INSERT INTO books(title,author,description,page_count,goodreads_rating,audiobook_length) VALUES(v_title,v_author,nullif(trim(p_input->>'description'),''),pages,rating,nullif(trim(p_input->>'audiobookLength'),''))
 ON CONFLICT(title,author) DO UPDATE SET description=coalesce(EXCLUDED.description,books.description),page_count=coalesce(EXCLUDED.page_count,books.page_count),goodreads_rating=coalesce(EXCLUDED.goodreads_rating,books.goodreads_rating),audiobook_length=coalesce(EXCLUDED.audiobook_length,books.audiobook_length) RETURNING * INTO b;
 SELECT id INTO nomination FROM book_nominations WHERE member_id=p_actor AND book_id=b.id AND meeting_number IS NULL;
 queued:=nomination IS NOT NULL;
 IF NOT queued THEN
  INSERT INTO book_nominations(member_id,book_id,book_title,book_author,status,notes) VALUES(p_actor,b.id,b.title,b.author,'suggested',nullif(trim(p_input->>'notes'),'')) RETURNING id INTO nomination;
 END IF;
 RETURN jsonb_build_object('nominationId',nomination,'alreadyQueued',queued,'book',jsonb_build_object('id',b.id,'title',b.title,'author',b.author));
END $$;

DO $$ DECLARE signature TEXT; role_name TEXT; BEGIN
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,5)='club_' LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',signature);
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I',signature,role_name);END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);END IF;
 END LOOP;
END $$;
