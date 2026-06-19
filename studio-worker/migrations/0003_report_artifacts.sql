PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report_artifacts (
  id TEXT PRIMARY KEY,
  report_version_id TEXT NOT NULL REFERENCES report_versions(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  content_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (report_version_id)
);

CREATE INDEX IF NOT EXISTS idx_report_artifacts_version ON report_artifacts(report_version_id);
