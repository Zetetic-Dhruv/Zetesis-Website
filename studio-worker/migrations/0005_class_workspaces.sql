PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS class_workspaces (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (class_id, user_id)
);

INSERT OR IGNORE INTO class_workspaces (class_id, user_id, workspace_id)
SELECT cm.class_id, cm.user_id, w.id
FROM class_memberships cm
JOIN team_members tm ON tm.user_id = cm.user_id
JOIN workspaces w ON w.team_id = tm.team_id
JOIN classes c ON c.id = cm.class_id AND c.default_engagement_id = w.engagement_id
WHERE cm.role = 'student';

CREATE INDEX IF NOT EXISTS idx_class_workspaces_user
  ON class_workspaces(user_id, class_id);
