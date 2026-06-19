PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_alg TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  password_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  default_engagement_id TEXT NOT NULL REFERENCES engagements(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS class_codes (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  permanent INTEGER NOT NULL DEFAULT 0,
  usage_limit_micros INTEGER NOT NULL DEFAULT 10000000,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  retired_at TEXT
);

CREATE TABLE IF NOT EXISTS class_memberships (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_code_id TEXT NOT NULL REFERENCES class_codes(id),
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
  model_access_status TEXT NOT NULL DEFAULT 'active' CHECK (model_access_status IN ('active', 'blocked')),
  usage_limit_micros INTEGER NOT NULL DEFAULT 10000000,
  usage_used_micros INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY,
  class_membership_id TEXT NOT NULL REFERENCES class_memberships(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  llm_run_id TEXT REFERENCES llm_runs(id) ON DELETE SET NULL,
  module TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_micros INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS report_versions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  report_text TEXT NOT NULL,
  pdf_r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (workspace_id, version_number)
);

CREATE TABLE IF NOT EXISTS abuse_events (
  id TEXT PRIMARY KEY,
  class_membership_id TEXT REFERENCES class_memberships(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  module TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

ALTER TABLE llm_runs ADD COLUMN class_membership_id TEXT REFERENCES class_memberships(id) ON DELETE SET NULL;
ALTER TABLE llm_runs ADD COLUMN system_prompt TEXT NOT NULL DEFAULT '';
ALTER TABLE llm_runs ADD COLUMN module_prompt TEXT NOT NULL DEFAULT '';
ALTER TABLE llm_runs ADD COLUMN model TEXT NOT NULL DEFAULT '';
ALTER TABLE llm_runs ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE llm_runs ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE llm_runs ADD COLUMN estimated_cost_micros INTEGER NOT NULL DEFAULT 0;
ALTER TABLE llm_runs ADD COLUMN guardrail_status TEXT NOT NULL DEFAULT 'ok';

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_class_codes_hash ON class_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_class_memberships_user ON class_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_class ON class_memberships(class_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_membership ON usage_ledger(class_membership_id);
CREATE INDEX IF NOT EXISTS idx_report_versions_workspace ON report_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_report_versions_user ON report_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_runs_user ON llm_runs(user_id);

INSERT OR IGNORE INTO classes (id, slug, name, status, default_engagement_id)
VALUES (
  'class_bethany_house_2026',
  'bethany-house-2026',
  'Bethany House Decision Engineering',
  'active',
  'eng_bethany_house_2026'
);
