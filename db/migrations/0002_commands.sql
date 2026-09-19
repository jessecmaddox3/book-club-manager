-- One club per installation. Short mutations share one lock, so role changes,
-- voting, finalization and canonical verdict edits cannot cross each other.
CREATE FUNCTION club_lock() RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM id FROM club_metadata WHERE id=1 FOR UPDATE; END $$;
CREATE FUNCTION club_actor(p_actor UUID,p_admin BOOLEAN DEFAULT FALSE) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_role TEXT;
BEGIN
 SELECT role INTO v_role FROM members WHERE id=p_actor;
 IF v_role IS NULL OR v_role='former' OR (p_admin AND v_role<>'admin') THEN
  RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
 END IF;
END $$;
CREATE FUNCTION club_today() RETURNS DATE LANGUAGE SQL STABLE AS $$
 SELECT CASE WHEN mode='demo' AND demo_date IS NOT NULL THEN demo_date ELSE (now() AT TIME ZONE time_zone)::date END FROM club_metadata WHERE id=1
$$;
CREATE FUNCTION club_recommender(p_name TEXT) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE ids UUID[];
BEGIN
 SELECT array_agg(DISTINCT id) INTO ids FROM members WHERE role<>'former' AND
 (id::text=p_name OR full_name=p_name OR display_name=p_name OR nickname=p_name);
 IF coalesce(array_length(ids,1),0)<>1 THEN RAISE EXCEPTION 'recommender_missing_or_ambiguous'; END IF;
 RETURN ids[1];
END $$;

CREATE FUNCTION club_replace_draft(p_actor UUID,p_expected INTEGER,p_definition JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE b ballots; n JSONB; d TEXT; book UUID; recommender UUID; old book_nominations; queued UUID; position INTEGER:=0; number INTEGER;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 number:=(p_definition->>'meetingNumber')::integer;
 IF number IS NULL OR number<1 OR jsonb_typeof(p_definition->'nominees') IS DISTINCT FROM 'array' OR jsonb_typeof(p_definition->'dates') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_definition'; END IF;
 IF jsonb_array_length(p_definition->'nominees')<2 OR jsonb_array_length(p_definition->'dates')<1 THEN RAISE EXCEPTION 'incomplete_definition'; END IF;
 SELECT * INTO b FROM ballots WHERE meeting_number=number;
 IF b.id IS NULL THEN
  IF p_expected IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'stale_ballot'; END IF;
  INSERT INTO ballots(survey_id,meeting_number) VALUES('meeting-'||number,number) RETURNING * INTO b;
 ELSE
  IF b.status<>'draft' THEN RAISE EXCEPTION 'draft_required'; END IF;
  IF b.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_ballot'; END IF;
  UPDATE ballots SET revision=revision+1 WHERE id=b.id RETURNING * INTO b;
 END IF;
 -- Return former shortlist entries to the queue without losing a second suggestion.
 FOR old IN SELECT * FROM book_nominations WHERE ballot_id=b.id LOOP
  SELECT id INTO queued FROM book_nominations WHERE meeting_number IS NULL AND member_id=old.member_id AND book_id=old.book_id;
  IF queued IS NOT NULL THEN
   UPDATE book_nominations SET notes=concat_ws(E'\n\n',nullif(notes,''),nullif(old.notes,'')) WHERE id=queued;
   DELETE FROM book_nominations WHERE id=old.id;
  ELSE UPDATE book_nominations SET meeting_number=NULL,ballot_id=NULL,status='suggested' WHERE id=old.id;
  END IF;
 END LOOP;
 DELETE FROM ballot_nominees WHERE ballot_id=b.id;
 DELETE FROM ballot_dates WHERE ballot_id=b.id;
 FOR n IN SELECT value FROM jsonb_array_elements(p_definition->'nominees') LOOP
  IF coalesce(length(trim(n->>'title')),0)=0 OR coalesce(length(trim(n->>'author')),0)=0 OR coalesce(length(trim(n->>'description')),0)=0 THEN RAISE EXCEPTION 'invalid_nominee'; END IF;
  recommender:=club_recommender(n->>'recommendedBy');
  INSERT INTO books(title,author,page_count,goodreads_rating,description,cover_image_url)
   VALUES(trim(n->>'title'),trim(n->>'author'),(n->>'pages')::integer,(n->>'goodreadsRating')::numeric,n->>'description',n->>'coverImage')
   ON CONFLICT(title,author) DO UPDATE SET page_count=EXCLUDED.page_count,goodreads_rating=EXCLUDED.goodreads_rating,description=EXCLUDED.description,cover_image_url=EXCLUDED.cover_image_url RETURNING id INTO book;
  INSERT INTO ballot_nominees(ballot_id,book_id,slug,recommended_by,subtitle,description,case_for,case_against,cover_image,pages,audiobook_length,goodreads_rating,sources,sort_order)
   VALUES(b.id,book,n->>'slug',recommender,n->>'subtitle',n->>'description',n->>'caseFor',n->>'caseAgainst',n->>'coverImage',(n->>'pages')::integer,n->>'audiobookLength',(n->>'goodreadsRating')::numeric,coalesce(n->'sources','[]'),position);
  position:=position+1;
  SELECT id INTO queued FROM book_nominations WHERE member_id=recommender AND book_id=book AND meeting_number IS NULL;
  IF queued IS NOT NULL THEN UPDATE book_nominations SET meeting_number=number,ballot_id=b.id,status='on_ballot' WHERE id=queued;
  ELSE INSERT INTO book_nominations(meeting_number,member_id,book_id,book_title,book_author,ballot_id,status) VALUES(number,recommender,book,n->>'title',n->>'author',b.id,'on_ballot'); END IF;
 END LOOP;
 FOR d IN SELECT jsonb_array_elements_text(p_definition->'dates') LOOP
  IF d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR to_char(d::date,'YYYY-MM-DD')<>d THEN RAISE EXCEPTION 'invalid_date'; END IF;
  INSERT INTO ballot_dates(ballot_id,date) VALUES(b.id,d::date);
 END LOOP;
 UPDATE ballots SET previous_meeting_id=(p_definition->>'previousMeetingId')::uuid WHERE id=b.id;
 RETURN jsonb_build_object('id',b.id,'revision',b.revision,'status','draft');
END $$;

CREATE FUNCTION club_open_ballot(p_actor UUID,p_ballot UUID,p_expected INTEGER) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE b ballots;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 SELECT * INTO b FROM ballots WHERE id=p_ballot;
 IF b.id IS NULL OR b.status<>'draft' THEN RAISE EXCEPTION 'draft_required'; END IF;
 IF b.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_ballot'; END IF;
 IF (SELECT count(*) FROM ballot_nominees WHERE ballot_id=b.id)<2 OR NOT EXISTS(SELECT 1 FROM ballot_dates WHERE ballot_id=b.id) THEN RAISE EXCEPTION 'incomplete_definition'; END IF;
 IF b.previous_meeting_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM meetings WHERE id=b.previous_meeting_id AND book_id IS NOT NULL AND state<>'tentative' AND number<b.meeting_number) THEN RAISE EXCEPTION 'invalid_previous_meeting'; END IF;
 UPDATE ballots SET status='open',opened_at=now(),revision=revision+1 WHERE id=b.id RETURNING * INTO b;
 RETURN jsonb_build_object('id',b.id,'revision',b.revision,'status',b.status);
END $$;

-- Tombstones preserve revisions when a verdict is explicitly cleared.
ALTER TABLE book_ratings DROP CONSTRAINT book_ratings_status_check;
ALTER TABLE book_ratings ADD CONSTRAINT book_ratings_status_check CHECK(status IN ('read','did_not_read','did_not_attend','unrated'));
CREATE FUNCTION club_save_verdict(p_actor UUID,p_meeting UUID,p_book UUID,p_status TEXT,p_rating INTEGER,p_expected INTEGER) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE m meetings; v_revision INTEGER; v_status TEXT;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor);
 SELECT * INTO m FROM meetings WHERE id=p_meeting;
 IF m.id IS NULL OR m.state='tentative' OR m.book_id IS NULL OR m.book_id IS DISTINCT FROM p_book THEN RAISE EXCEPTION 'reading_assignment_changed'; END IF;
 v_status:=CASE WHEN p_status='clear' THEN 'unrated' ELSE p_status END;
 IF v_status IS NULL OR v_status NOT IN ('read','did_not_read','did_not_attend','unrated') OR (v_status='read' AND (p_rating IS NULL OR p_rating<1 OR p_rating>5)) OR (v_status<>'read' AND p_rating IS NOT NULL) THEN RAISE EXCEPTION 'invalid_verdict'; END IF;
 SELECT revision INTO v_revision FROM book_ratings WHERE meeting_id=p_meeting AND member_id=p_actor;
 IF coalesce(v_revision,0) IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_verdict'; END IF;
 INSERT INTO book_ratings(meeting_id,member_id,rating,status,revision) VALUES(p_meeting,p_actor,p_rating,v_status,1)
  ON CONFLICT(meeting_id,member_id) DO UPDATE SET rating=EXCLUDED.rating,status=EXCLUDED.status,revision=book_ratings.revision+1,updated_at=now() RETURNING revision INTO v_revision;
 RETURN jsonb_build_object('revision',v_revision,'status',v_status,'rating',p_rating);
END $$;

CREATE FUNCTION club_submit_survey(p_actor UUID,p_ballot UUID,p_ballot_revision INTEGER,p_response_revision INTEGER,p_ratings JSONB,p_dates JSONB,p_host BOOLEAN,p_beverage BOOLEAN,p_verdict JSONB DEFAULT NULL) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE b ballots; v_revision INTEGER; entry RECORD; v_verdict JSONB;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor);
 SELECT * INTO b FROM ballots WHERE id=p_ballot;
 IF b.id IS NULL OR b.status<>'open' THEN RAISE EXCEPTION 'ballot_closed'; END IF;
 IF b.revision IS DISTINCT FROM p_ballot_revision THEN RAISE EXCEPTION 'stale_ballot'; END IF;
 IF jsonb_typeof(p_ratings) IS DISTINCT FROM 'object' OR jsonb_typeof(p_dates) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_response'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_ratings))<>(SELECT count(*) FROM ballot_nominees WHERE ballot_id=b.id) THEN RAISE EXCEPTION 'rate_every_book'; END IF;
 FOR entry IN SELECT key,value FROM jsonb_each(p_ratings) LOOP
  IF NOT EXISTS(SELECT 1 FROM ballot_nominees WHERE ballot_id=b.id AND slug=entry.key) OR jsonb_typeof(entry.value)<>'number' OR entry.value::text !~ '^[1-5]$' THEN RAISE EXCEPTION 'invalid_rating'; END IF;
 END LOOP;
 FOR entry IN SELECT key,value FROM jsonb_each_text(p_dates) LOOP
  IF NOT EXISTS(SELECT 1 FROM ballot_dates WHERE ballot_id=b.id AND to_char(date,'YYYY-MM-DD')=entry.key) OR entry.value IS NULL OR entry.value NOT IN ('yes','maybe','no') THEN RAISE EXCEPTION 'invalid_availability'; END IF;
 END LOOP;
 SELECT revision INTO v_revision FROM survey_responses WHERE ballot_id=b.id AND member_id=p_actor;
 IF coalesce(v_revision,0) IS DISTINCT FROM p_response_revision THEN RAISE EXCEPTION 'stale_response'; END IF;
 IF p_verdict IS NOT NULL THEN
  IF jsonb_typeof(p_verdict) IS DISTINCT FROM 'object' OR b.previous_meeting_id IS NULL OR b.previous_meeting_id IS DISTINCT FROM (p_verdict->>'meetingId')::uuid THEN RAISE EXCEPTION 'previous_meeting_changed'; END IF;
  v_verdict:=club_save_verdict(p_actor,b.previous_meeting_id,(p_verdict->>'bookId')::uuid,p_verdict->>'status',(p_verdict->>'rating')::integer,(p_verdict->>'revision')::integer);
 END IF;
 INSERT INTO survey_responses(survey_id,ballot_id,member_id,ratings,date_preferences,willing_to_host,willing_to_bring_bourbon,revision)
  VALUES(b.survey_id,b.id,p_actor,p_ratings,p_dates,coalesce(p_host,FALSE),coalesce(p_beverage,FALSE),1)
  ON CONFLICT(ballot_id,member_id) DO UPDATE SET ratings=EXCLUDED.ratings,date_preferences=EXCLUDED.date_preferences,willing_to_host=EXCLUDED.willing_to_host,willing_to_bring_bourbon=EXCLUDED.willing_to_bring_bourbon,revision=survey_responses.revision+1,updated_at=now() RETURNING revision INTO v_revision;
 UPDATE ballots SET responses_revision=responses_revision+1 WHERE id=b.id;
 RETURN jsonb_build_object('revision',v_revision,'verdict',v_verdict);
END $$;

CREATE FUNCTION club_close_ballot(p_actor UUID,p_operation UUID,p_payload JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE b ballots; receipt command_receipts; existing meetings; v_meeting UUID; v_book UUID; v_date DATE; v_host UUID; volunteers UUID[]; v_result JSONB;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 IF p_operation IS NULL THEN RAISE EXCEPTION 'operation_id_required'; END IF;
 SELECT * INTO receipt FROM command_receipts WHERE operation_id=p_operation;
 IF receipt.operation_id IS NOT NULL THEN
  IF receipt.actor_id IS DISTINCT FROM p_actor OR receipt.command IS DISTINCT FROM 'close' OR receipt.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'operation_id_reused'; END IF;
  RETURN receipt.result;
 END IF;
 SELECT * INTO b FROM ballots WHERE id=(p_payload->>'ballotId')::uuid;
 IF b.id IS NULL OR b.status<>'open' THEN RAISE EXCEPTION 'ballot_not_open'; END IF;
 IF b.revision IS DISTINCT FROM (p_payload->>'revision')::integer OR b.responses_revision IS DISTINCT FROM (p_payload->>'responsesRevision')::integer THEN RAISE EXCEPTION 'stale_close_preview'; END IF;
 v_book:=(p_payload->>'selectedBookId')::uuid;v_date:=(p_payload->>'date')::date;v_host:=(p_payload->>'hostId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM ballot_nominees WHERE ballot_id=b.id AND book_id=v_book) THEN RAISE EXCEPTION 'selected_book_not_on_ballot'; END IF;
 IF v_date IS NULL OR NOT EXISTS(SELECT 1 FROM ballot_dates WHERE ballot_id=b.id AND date=v_date) THEN RAISE EXCEPTION 'date_not_on_ballot'; END IF;
 IF v_host IS NOT NULL AND NOT EXISTS(SELECT 1 FROM members WHERE id=v_host AND role<>'former') THEN RAISE EXCEPTION 'invalid_host'; END IF;
 SELECT coalesce(array_agg(value::uuid),ARRAY[]::uuid[]) INTO volunteers FROM jsonb_array_elements_text(coalesce(p_payload->'beverageMemberIds','[]'));
 IF EXISTS(SELECT 1 FROM unnest(volunteers) AS v WHERE NOT EXISTS(SELECT 1 FROM members WHERE id=v AND role<>'former')) THEN RAISE EXCEPTION 'invalid_volunteer'; END IF;
 IF EXISTS(SELECT 1 FROM meetings m JOIN book_ratings r ON r.meeting_id=m.id WHERE m.number=b.meeting_number AND r.status<>'unrated') THEN RAISE EXCEPTION 'meeting_has_verdicts'; END IF;
 SELECT * INTO existing FROM meetings WHERE number=b.meeting_number;
 IF existing.id IS NOT NULL AND (existing.ballot_id IS DISTINCT FROM b.id OR existing.state<>'tentative' OR existing.date IS NULL OR existing.date<=club_today()) THEN RAISE EXCEPTION 'meeting_number_already_used'; END IF;
 INSERT INTO meetings(number,book_id,date,host_id,location,format,state,ballot_id)
 VALUES(b.meeting_number,v_book,v_date,v_host,p_payload->>'location','In-person',CASE WHEN v_date<club_today() THEN 'held' ELSE 'scheduled' END,b.id)
 ON CONFLICT(number) DO UPDATE SET book_id=EXCLUDED.book_id,date=EXCLUDED.date,host_id=EXCLUDED.host_id,location=EXCLUDED.location,state=EXCLUDED.state,revision=meetings.revision+1 RETURNING id INTO v_meeting;
 DELETE FROM meeting_bourbon_volunteers WHERE meeting_id=v_meeting;
 INSERT INTO meeting_bourbon_volunteers(meeting_id,member_id) SELECT v_meeting,unnest(volunteers) ON CONFLICT DO NOTHING;
 DELETE FROM historical_votes WHERE ballot_id=b.id;
 DELETE FROM historical_ballots WHERE ballot_id=b.id;
 -- The response snapshot is computed only after taking the same lock as submit.
 INSERT INTO historical_votes(ballot_id,book_id,meeting_number,voter_id,voter_name,book_title,rating)
 SELECT b.id,n.book_id,b.meeting_number,r.member_id,m.display_name,book.title,(r.ratings->>n.slug)::numeric
 FROM survey_responses r JOIN members m ON m.id=r.member_id JOIN ballot_nominees n ON n.ballot_id=b.id JOIN books book ON book.id=n.book_id WHERE r.ballot_id=b.id;
 INSERT INTO historical_ballots(ballot_id,book_id,meeting_number,book_title,goodreads_rating,average_rating,was_selected,num_voters)
 SELECT b.id,n.book_id,b.meeting_number,book.title,n.goodreads_rating,round(avg(v.rating),2),n.book_id=v_book,count(v.id)::integer
 FROM ballot_nominees n JOIN books book ON book.id=n.book_id LEFT JOIN historical_votes v ON v.ballot_id=b.id AND v.book_id=n.book_id WHERE n.ballot_id=b.id GROUP BY n.book_id,book.title,n.goodreads_rating;
 UPDATE ballots SET status='closed',closed_at=now(),selected_book_id=v_book,selected_date=v_date,revision=revision+1 WHERE id=b.id RETURNING * INTO b;
 UPDATE book_nominations SET status=CASE WHEN book_id=v_book THEN 'selected' ELSE 'passed' END WHERE ballot_id=b.id;
 v_result:=jsonb_build_object('meetingId',v_meeting,'revision',b.revision,'standings',(SELECT jsonb_agg(to_jsonb(h) ORDER BY h.book_id) FROM historical_ballots h WHERE h.ballot_id=b.id));
 INSERT INTO command_receipts(operation_id,actor_id,command,payload,result) VALUES(p_operation,p_actor,'close',p_payload,v_result);
 RETURN v_result;
END $$;

CREATE FUNCTION club_reopen_ballot(p_actor UUID,p_ballot UUID,p_expected INTEGER) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE b ballots; m meetings;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 SELECT * INTO b FROM ballots WHERE id=p_ballot;
 IF b.id IS NULL OR b.status<>'closed' THEN RAISE EXCEPTION 'closed_ballot_required'; END IF;
 IF b.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_ballot'; END IF;
 SELECT * INTO m FROM meetings WHERE number=b.meeting_number;
 IF m.id IS NULL OR m.ballot_id IS DISTINCT FROM b.id OR m.date IS NULL OR m.date<=club_today() OR m.state='held' THEN RAISE EXCEPTION 'meeting_already_happened_or_unknown'; END IF;
 IF EXISTS(SELECT 1 FROM book_ratings WHERE meeting_id=m.id AND status<>'unrated') THEN RAISE EXCEPTION 'meeting_has_verdicts'; END IF;
 DELETE FROM historical_votes WHERE ballot_id=b.id;DELETE FROM historical_ballots WHERE ballot_id=b.id;
 DELETE FROM meeting_bourbon_volunteers WHERE meeting_id=m.id;
 UPDATE meetings SET state='tentative',book_id=NULL,revision=revision+1 WHERE id=m.id;
 UPDATE ballots SET status='open',closed_at=NULL,selected_book_id=NULL,selected_date=NULL,revision=revision+1 WHERE id=b.id RETURNING * INTO b;
 UPDATE book_nominations SET status='on_ballot' WHERE ballot_id=b.id;
 RETURN jsonb_build_object('id',b.id,'revision',b.revision,'status','open');
END $$;

-- Commands are server-only. Do not alter unrelated extension functions.
DO $$ DECLARE role_name TEXT; signature TEXT; BEGIN
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,5)='club_' LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',signature);
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I',signature,role_name);
   END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);
  END IF;
 END LOOP;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I',role_name);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
 END IF;
END $$;
