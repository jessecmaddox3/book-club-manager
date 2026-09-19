ALTER TABLE model_runs ADD COLUMN input_snapshot JSONB NOT NULL;
ALTER TABLE model_runs ADD COLUMN request_payload JSONB NOT NULL;

-- The same short club lock used by ballot/member/genre mutations makes each
-- snapshot coherent. No member names, titles or aliases are identity keys.
CREATE FUNCTION club_prediction_snapshot(p_actor UUID,p_target UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE result JSONB;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 SELECT jsonb_build_object(
  'format','preference-additive-v1',
  'target',jsonb_build_object('id',target.id,'meetingNumber',target.meeting_number,'surveyId',target.survey_id,'revision',target.revision,'status',target.status),
  'audience',coalesce((SELECT jsonb_agg(jsonb_build_object('memberId',m.id,'name',m.full_name) ORDER BY m.id) FROM members m WHERE m.role IN('admin','member')),'[]'::jsonb),
  'nominees',coalesce((SELECT jsonb_agg(jsonb_build_object('bookId',b.id,'title',b.title,'author',b.author,'genre',b.genre,'submitterId',n.recommended_by) ORDER BY b.id) FROM ballot_nominees n JOIN books b ON b.id=n.book_id WHERE n.ballot_id=target.id),'[]'::jsonb),
  'history',coalesce((SELECT jsonb_agg(jsonb_build_object('ballotId',ballot.id,'meeting',ballot.meeting_number,'memberId',h.voter_id,'bookId',h.book_id,'rating',h.rating,'genre',b.genre,'submitterId',n.recommended_by) ORDER BY ballot.meeting_number,ballot.id,h.voter_id,h.book_id)
   FROM historical_votes h JOIN ballots ballot ON ballot.id=h.ballot_id AND ballot.status='closed' AND ballot.meeting_number<target.meeting_number
   JOIN ballot_nominees n ON n.ballot_id=ballot.id AND n.book_id=h.book_id JOIN books b ON b.id=h.book_id),'[]'::jsonb)
 ) INTO result FROM ballots target WHERE target.id=p_target;
 IF result IS NULL THEN RAISE EXCEPTION 'target_ballot_not_found';END IF;
 RETURN result;
END $$;

CREATE FUNCTION club_save_prediction_run(p_actor UUID,p_operation UUID,p_request JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE prior model_runs; created model_runs; expected JSONB:=p_request->'snapshot'; current_input JSONB; prediction JSONB; target UUID:=(p_request->'snapshot'->'target'->>'id')::uuid; expected_count INTEGER; supplied_count INTEGER;
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 SELECT * INTO prior FROM model_runs WHERE operation_id=p_operation;
 IF prior.id IS NOT NULL THEN
  IF prior.request_payload IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'operation_id_reused';END IF;
  RETURN jsonb_build_object('runId',prior.id,'replayed',TRUE);
 END IF;
 IF p_request IS NULL OR p_request->>'version' IS DISTINCT FROM 'preference-additive-v1' OR jsonb_typeof(p_request->'predictions') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_prediction_run';END IF;
 current_input:=club_prediction_snapshot(p_actor,target);
 IF current_input IS DISTINCT FROM expected THEN RAISE EXCEPTION 'stale_prediction_input';END IF;
 expected_count:=jsonb_array_length(expected->'audience')*jsonb_array_length(expected->'nominees');
 supplied_count:=jsonb_array_length(p_request->'predictions');
 IF expected_count=0 OR supplied_count<>expected_count THEN RAISE EXCEPTION 'incomplete_prediction_grid';END IF;
 INSERT INTO model_runs(operation_id,target_ballot_id,input_digest,model_version,configuration,evaluation,input_snapshot,request_payload)
 VALUES(p_operation,target,encode(sha256(convert_to(expected::text,'UTF8')),'hex'),p_request->>'version',p_request->'configuration',p_request->'evaluation',expected,p_request) RETURNING * INTO created;
 FOR prediction IN SELECT value FROM jsonb_array_elements(p_request->'predictions') LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(expected->'audience') x WHERE x->>'memberId'=prediction->>'memberId')
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(expected->'nominees') x WHERE x->>'bookId'=prediction->>'bookId')
   OR jsonb_typeof(prediction->'predicted') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_prediction_identity';END IF;
  INSERT INTO rating_predictions(survey_id,member_name,book_title,predicted,actual,model_version,run_id,member_id,book_id)
  VALUES(expected->'target'->>'surveyId',(SELECT x->>'name' FROM jsonb_array_elements(expected->'audience') x WHERE x->>'memberId'=prediction->>'memberId'),
   (SELECT x->>'title' FROM jsonb_array_elements(expected->'nominees') x WHERE x->>'bookId'=prediction->>'bookId'),(prediction->>'predicted')::numeric,NULL,p_request->>'version',created.id,(prediction->>'memberId')::uuid,(prediction->>'bookId')::uuid);
 END LOOP;
 RETURN jsonb_build_object('runId',created.id,'replayed',FALSE);
END $$;

CREATE FUNCTION club_set_genres(p_actor UUID,p_updates JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE entry JSONB; b books; seen UUID[]:=ARRAY[]::uuid[]; allowed TEXT[]:=ARRAY['politics','economics-finance','history','memoir-biography','science-tech','philosophy-psychology','business-management','society-culture','sports-adventure','true-crime','nature-environment','fantasy','literary-fiction','mystery','science-fiction','humor','adventure','nonfiction','romance','poetry','graphic-novel'];
BEGIN
 PERFORM club_lock();PERFORM club_actor(p_actor,TRUE);
 IF jsonb_typeof(p_updates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_updates)>1000 THEN RAISE EXCEPTION 'invalid_genre_updates';END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_updates) LOOP
  SELECT * INTO b FROM books WHERE id=(entry->>'bookId')::uuid;
  IF b.id IS NULL OR b.id=ANY(seen) OR entry->>'genre' IS NULL OR NOT(entry->>'genre'=ANY(allowed)) OR NOT(entry?'expectedGenre') THEN RAISE EXCEPTION 'invalid_genre_update';END IF;
  IF b.genre IS DISTINCT FROM entry->>'expectedGenre' THEN RAISE EXCEPTION 'stale_genre';END IF;
  seen:=array_append(seen,b.id);UPDATE books SET genre=entry->>'genre' WHERE id=b.id;
 END LOOP;
 RETURN jsonb_build_object('updated',cardinality(seen));
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
