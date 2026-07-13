PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_module_states (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  state_json TEXT NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'ground',
  status TEXT NOT NULL DEFAULT 'draft',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (workspace_id, module_key)
);

CREATE TABLE IF NOT EXISTS deliverable_versions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state_json TEXT NOT NULL,
  document_json TEXT NOT NULL,
  document_text TEXT NOT NULL,
  pdf_r2_key TEXT NOT NULL,
  confidence_config_version TEXT NOT NULL DEFAULT '',
  confidence_input_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (workspace_id, module_key, version_number)
);

CREATE TABLE IF NOT EXISTS deliverable_artifacts (
  id TEXT PRIMARY KEY,
  deliverable_version_id TEXT NOT NULL REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  content_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (deliverable_version_id)
);

ALTER TABLE llm_runs ADD COLUMN workflow_key TEXT NOT NULL DEFAULT 'module_1';

CREATE INDEX IF NOT EXISTS idx_workspace_module_states_module
  ON workspace_module_states(module_key, updated_at);
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_owner
  ON deliverable_versions(user_id, class_id, module_key, created_at);
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_workspace
  ON deliverable_versions(workspace_id, module_key, version_number);
CREATE INDEX IF NOT EXISTS idx_deliverable_artifacts_version
  ON deliverable_artifacts(deliverable_version_id);
CREATE INDEX IF NOT EXISTS idx_llm_runs_workflow
  ON llm_runs(workflow_key, user_id, created_at);
