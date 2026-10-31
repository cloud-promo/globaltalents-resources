-- Global Talents Resources : schéma de la base (idempotent, rejoué à chaque démarrage)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  currency text NOT NULL,
  phone_prefix text NOT NULL,
  dpa text NOT NULL,
  sort int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cities (
  id serial PRIMARY KEY,
  country_code text NOT NULL REFERENCES countries(code),
  name text NOT NULL,
  UNIQUE (country_code, name)
);

CREATE TABLE IF NOT EXISTS functions (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sectors (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('candidate', 'recruiter', 'admin', 'moderator')),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  country_code text REFERENCES countries(code),
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  birth_date date,
  nationality text NOT NULL DEFAULT '',
  experience_level text NOT NULL DEFAULT '',
  study_level text NOT NULL DEFAULT '',
  current_function_id int REFERENCES functions(id),
  desired_function_ids int[] NOT NULL DEFAULT '{}',
  search_countries text[] NOT NULL DEFAULT '{}',
  current_salary text NOT NULL DEFAULT '',
  desired_salary text NOT NULL DEFAULT '',
  availability text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  visible_cvtheque boolean NOT NULL DEFAULT true,
  public_profile boolean NOT NULL DEFAULT false,
  show_photo boolean NOT NULL DEFAULT true,
  share_test boolean NOT NULL DEFAULT false,
  notify_cv_viewed boolean NOT NULL DEFAULT true,
  newsletter boolean NOT NULL DEFAULT true,
  newsletter_frequency text NOT NULL DEFAULT 'hebdomadaire',
  partner_offers boolean NOT NULL DEFAULT false,
  whatsapp_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  company text NOT NULL,
  city text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS educations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  degree text NOT NULL,
  school text NOT NULL,
  field text NOT NULL DEFAULT '',
  year_end int
);

CREATE TABLE IF NOT EXISTS candidate_skills (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  PRIMARY KEY (user_id, name)
);

CREATE TABLE IF NOT EXISTS candidate_languages (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text NOT NULL,
  PRIMARY KEY (user_id, name)
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cv', 'other')),
  filename text NOT NULL,
  mime text NOT NULL,
  size int NOT NULL,
  data bytea NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_user_idx ON documents(user_id);

CREATE TABLE IF NOT EXISTS plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  price_xof int NOT NULL,
  period text NOT NULL CHECK (period IN ('once', 'month')),
  job_credits int NOT NULL DEFAULT 0,
  cv_credits int NOT NULL DEFAULT 0,
  cv_unlimited boolean NOT NULL DEFAULT false,
  duration_days int NOT NULL DEFAULT 30,
  sort int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  country_code text NOT NULL REFERENCES countries(code),
  city text NOT NULL DEFAULT '',
  sector_id int REFERENCES sectors(id),
  size_band text NOT NULL DEFAULT '',
  registration_number text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  culture text NOT NULL DEFAULT '',
  benefits text NOT NULL DEFAULT '',
  brand_color text NOT NULL DEFAULT '#2B3A8C',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'suspended')),
  featured boolean NOT NULL DEFAULT false,
  plan_code text REFERENCES plans(code),
  plan_expires_at timestamptz,
  job_credits int NOT NULL DEFAULT 1,
  cv_credits int NOT NULL DEFAULT 0,
  cv_unlimited_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_members (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'recruiter' CHECK (role IN ('admin', 'recruiter', 'manager')),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX IF NOT EXISTS company_members_user_idx ON company_members(user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id serial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  function_id int REFERENCES functions(id),
  sector_id int REFERENCES sectors(id),
  country_code text NOT NULL REFERENCES countries(code),
  city text NOT NULL DEFAULT '',
  contract_type text NOT NULL,
  experience_level text NOT NULL DEFAULT '',
  study_level text NOT NULL DEFAULT '',
  remote text NOT NULL DEFAULT 'non',
  management boolean NOT NULL DEFAULT false,
  languages text[] NOT NULL DEFAULT '{}',
  salary_min int,
  salary_max int,
  show_salary boolean NOT NULL DEFAULT false,
  positions int NOT NULL DEFAULT 1,
  description text NOT NULL,
  profile text NOT NULL DEFAULT '',
  benefits text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  confidential boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'expired', 'archived')),
  reject_reason text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  expires_at timestamptz,
  views int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status, published_at DESC);
CREATE INDEX IF NOT EXISTS jobs_company_idx ON jobs(company_id);
CREATE INDEX IF NOT EXISTS jobs_search_idx ON jobs USING gin (to_tsvector('french', title || ' ' || description || ' ' || profile));

CREATE TABLE IF NOT EXISTS job_questions (
  id serial PRIMARY KEY,
  job_id int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  question text NOT NULL,
  eliminatory boolean NOT NULL DEFAULT false,
  expected text NOT NULL DEFAULT 'oui',
  sort int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  cover_letter text NOT NULL DEFAULT '',
  answers jsonb NOT NULL DEFAULT '[]',
  score int NOT NULL DEFAULT 0,
  score_reasons jsonb NOT NULL DEFAULT '[]',
  stage text NOT NULL DEFAULT 'nouvelle',
  anonymous boolean NOT NULL DEFAULT false,
  share_test boolean NOT NULL DEFAULT false,
  failed_screening boolean NOT NULL DEFAULT false,
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS applications_candidate_idx ON applications(candidate_id);

CREATE TABLE IF NOT EXISTS application_events (
  id serial PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  visible_to_candidate boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_events_app_idx ON application_events(application_id);

CREATE TABLE IF NOT EXISTS application_notes (
  id serial PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  rating int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  query jsonb NOT NULL,
  email boolean NOT NULL DEFAULT true,
  whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS followed_companies (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS hidden_companies (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cv_unlocks (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlocked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  plan_code text NOT NULL REFERENCES plans(code),
  amount int NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  provider text NOT NULL,
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  reference text NOT NULL UNIQUE,
  invoice_number text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS articles (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  excerpt text NOT NULL,
  body text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  views int NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_reports (
  id serial PRIMARY KEY,
  job_id int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_counter (
  year int PRIMARY KEY,
  last int NOT NULL DEFAULT 0
);

-- Paiements e-Wari (lot V1)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pay_url text NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS qr_payload text NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason text NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee int;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer text NOT NULL DEFAULT '';
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired'));
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_id_idx ON payments(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_events (
  event_id text PRIMARY KEY,
  provider text NOT NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
