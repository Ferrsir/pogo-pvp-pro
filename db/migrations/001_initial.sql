CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(24) NOT NULL,
  username_normalized VARCHAR(24) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  team VARCHAR(20) NOT NULL CHECK (team IN ('Mystic', 'Valor', 'Instinct', 'Unaffiliated')),
  trainer_level SMALLINT NOT NULL CHECK (trainer_level BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS trainer_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  collection JSONB NOT NULL DEFAULT '[]'::jsonb,
  saved_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_attempts (
  key_hash CHAR(64) PRIMARY KEY,
  attempts SMALLINT NOT NULL DEFAULT 0,
  window_started TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ
)
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_attempts_blocked_until_idx ON auth_attempts(blocked_until)
