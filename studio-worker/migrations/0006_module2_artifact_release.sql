ALTER TABLE deliverable_versions
  ADD COLUMN artifact_release_class TEXT NOT NULL DEFAULT 'unclassified'
  CHECK (artifact_release_class IN ('unclassified', 'client_no_confidence', 'audited_confidence'));
