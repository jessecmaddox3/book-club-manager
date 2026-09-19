-- Fresh one-club schema. No private datasets or migration history are included.
-- Shared by embedded local PostgreSQL (PGlite) and production PostgreSQL.
CREATE TABLE club_metadata (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 instance_id UUID NOT NULL DEFAULT gen_random_uuid(),
 generation UUID NOT NULL DEFAULT gen_random_uuid(),
 mode TEXT NOT NULL CHECK (mode IN ('demo','production')),
 time_zone TEXT NOT NULL DEFAULT 'UTC',
 demo_date DATE,
 CHECK (mode='demo' OR demo_date IS NULL)
);
INSERT INTO club_metadata(id,mode) VALUES (1,'production');

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  nickname TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'former')),
  reminder_exempt BOOLEAN NOT NULL DEFAULT false,
  joined_info TEXT,
  left_info TEXT,
  bio TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX members_nickname_idx
  ON members (lower(nickname))
  WHERE nickname IS NOT NULL;

CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  goodreads_rating NUMERIC(3,2),
  cover_image_url TEXT,
  page_count INTEGER,
  description TEXT,
  genre TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX books_title_author_idx ON books (title, author);

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER UNIQUE NOT NULL,
  book_id UUID REFERENCES books(id),
  date DATE,
  date_end DATE,
  date_estimate TEXT,
  host_id UUID REFERENCES members(id),
  location TEXT,
  format TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE book_ratings (
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  status TEXT NOT NULL DEFAULT 'read'
    CHECK (status IN ('read', 'did_not_read', 'did_not_attend')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'read' AND rating IS NOT NULL)
    OR (status <> 'read' AND rating IS NULL)
  ),
  PRIMARY KEY (meeting_id, member_id)
);

CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id),
  ratings JSONB NOT NULL,
  willing_to_host BOOLEAN DEFAULT false,
  willing_to_bring_bourbon BOOLEAN DEFAULT false,
  previous_book_rating INTEGER
    CHECK (previous_book_rating IS NULL OR (previous_book_rating >= 1 AND previous_book_rating <= 5)),
  date_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (survey_id, member_id)
);

CREATE TABLE historical_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_number INTEGER NOT NULL,
  voter_name TEXT NOT NULL,
  voter_id UUID REFERENCES members(id),
  book_title TEXT NOT NULL,
  rating NUMERIC(3,1)
);

CREATE TABLE historical_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_number INTEGER NOT NULL,
  book_title TEXT NOT NULL,
  goodreads_rating NUMERIC(3,2),
  average_rating NUMERIC(4,2),
  was_selected BOOLEAN DEFAULT false,
  num_voters INTEGER
);

CREATE TABLE bourbons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  distillery TEXT,
  proof NUMERIC(5,1),
  tasting_notes TEXT,
  image_url TEXT,
  price_range TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE meeting_bourbons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  bourbon_id UUID REFERENCES bourbons(id),
  brought_by UUID REFERENCES members(id),
  bourbon_name_raw TEXT
);

CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  prediction TEXT NOT NULL,
  result TEXT CHECK (result IS NULL OR result IN ('Yes', 'No', 'Partial')),
  result_notes TEXT,
  scored_by UUID REFERENCES members(id),
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  goal TEXT NOT NULL,
  result TEXT CHECK (result IS NULL OR result IN ('Yes', 'No', 'Partial')),
  result_notes TEXT,
  scored_by UUID REFERENCES members(id),
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rating_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  book_title TEXT NOT NULL,
  predicted NUMERIC(2,1) NOT NULL CHECK (predicted >= 1 AND predicted <= 5),
  actual NUMERIC(2,1) CHECK (actual IS NULL OR (actual >= 1 AND actual <= 5)),
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rating_predictions_survey_id_idx
  ON rating_predictions (survey_id);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bourbons ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_bourbons ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_predictions ENABLE ROW LEVEL SECURITY;

CREATE TABLE ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id TEXT NOT NULL UNIQUE,
  meeting_number INTEGER NOT NULL UNIQUE CHECK (meeting_number > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  selected_book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  selected_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ballots_one_open_idx ON ballots ((true)) WHERE status = 'open';

CREATE TABLE ballot_nominees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  recommended_by UUID REFERENCES members(id) ON DELETE SET NULL,
  subtitle TEXT,
  description TEXT,
  case_for TEXT,
  case_against TEXT,
  cover_image TEXT,
  pages INTEGER CHECK (pages IS NULL OR pages > 0),
  audiobook_length TEXT,
  goodreads_rating NUMERIC(3,2) CHECK (goodreads_rating IS NULL OR (goodreads_rating >= 0 AND goodreads_rating <= 5)),
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  UNIQUE (ballot_id, slug),
  UNIQUE (ballot_id, book_id)
);
CREATE INDEX ballot_nominees_ballot_idx ON ballot_nominees (ballot_id);

CREATE TABLE ballot_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  UNIQUE (ballot_id, date)
);

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (event, ballot_id, member_id)
);

CREATE TABLE meeting_bourbon_volunteers (
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, member_id)
);

ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ballot_nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE ballot_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_bourbon_volunteers ENABLE ROW LEVEL SECURITY;

CREATE TABLE book_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_number INTEGER,
  member_id UUID REFERENCES members(id),
  book_title TEXT NOT NULL,
  book_author TEXT,
  book_id UUID REFERENCES books(id),
  ballot_id UUID REFERENCES ballots(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'on_ballot', 'selected', 'passed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX book_nominations_meeting_member_book_idx
  ON book_nominations (meeting_number, member_id, book_id);
CREATE UNIQUE INDEX book_nominations_unassigned_member_book_idx
  ON book_nominations (member_id, book_id)
  WHERE meeting_number IS NULL;

ALTER TABLE book_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ADD COLUMN auth_subject UUID UNIQUE;
ALTER TABLE meetings ADD COLUMN state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled','held','tentative'));
ALTER TABLE ballots ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE ballots ADD COLUMN responses_revision INTEGER NOT NULL DEFAULT 0 CHECK (responses_revision >= 0);
ALTER TABLE ballots ADD COLUMN previous_meeting_id UUID REFERENCES meetings(id);
ALTER TABLE meetings ADD COLUMN ballot_id UUID UNIQUE REFERENCES ballots(id);
ALTER TABLE survey_responses ADD COLUMN ballot_id UUID NOT NULL REFERENCES ballots(id);
ALTER TABLE survey_responses ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE survey_responses DROP COLUMN previous_book_rating;
ALTER TABLE survey_responses ADD CONSTRAINT survey_ballot_member_unique UNIQUE (ballot_id,member_id);
ALTER TABLE historical_ballots ADD COLUMN ballot_id UUID NOT NULL REFERENCES ballots(id);
ALTER TABLE historical_ballots ADD COLUMN book_id UUID NOT NULL REFERENCES books(id);
ALTER TABLE historical_ballots ADD CONSTRAINT history_book_identity UNIQUE (ballot_id,book_id);
ALTER TABLE historical_votes ADD COLUMN ballot_id UUID NOT NULL REFERENCES ballots(id);
ALTER TABLE historical_votes ADD COLUMN book_id UUID NOT NULL REFERENCES books(id);
ALTER TABLE historical_votes ALTER COLUMN voter_id SET NOT NULL;
ALTER TABLE historical_votes ADD CONSTRAINT history_vote_identity UNIQUE (ballot_id,voter_id,book_id);
CREATE TABLE model_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 operation_id UUID NOT NULL UNIQUE,
 target_ballot_id UUID REFERENCES ballots(id),
 input_digest TEXT NOT NULL,
 model_version TEXT NOT NULL,
 configuration JSONB NOT NULL,
 evaluation JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rating_predictions ADD COLUMN run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE;
ALTER TABLE rating_predictions ADD COLUMN member_id UUID NOT NULL REFERENCES members(id);
ALTER TABLE rating_predictions ADD COLUMN book_id UUID NOT NULL REFERENCES books(id);
ALTER TABLE rating_predictions ADD CONSTRAINT model_prediction_identity UNIQUE (run_id,member_id,book_id);
CREATE TABLE command_receipts (
 operation_id UUID PRIMARY KEY,
 actor_id UUID NOT NULL REFERENCES members(id),
 command TEXT NOT NULL,
 payload JSONB NOT NULL,
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE club_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
