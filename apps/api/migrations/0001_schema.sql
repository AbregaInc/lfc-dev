CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  org_id TEXT REFERENCES orgs(id),
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tools TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, profile_id)
);

CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('team', 'enterprise')),
  message TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, plan)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS artifact_releases (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  reliability_tier TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  source_version TEXT,
  digest TEXT,
  manifest_json TEXT NOT NULL,
  runtime_json TEXT,
  install_json TEXT,
  launch_json TEXT,
  verify_json TEXT,
  compatibility_json TEXT,
  payload_json TEXT,
  review_notes TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  approved_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  UNIQUE (artifact_id, version)
);

CREATE TABLE IF NOT EXISTS artifact_bindings (
  id TEXT PRIMARY KEY,
  artifact_release_id TEXT NOT NULL REFERENCES artifact_releases(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  binding_type TEXT NOT NULL,
  binding_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artifact_submissions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_device_id TEXT REFERENCES devices(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  artifact_kind TEXT NOT NULL,
  source_tool TEXT,
  reliability_tier TEXT,
  raw_capture_json TEXT NOT NULL,
  normalized_release_id TEXT REFERENCES artifact_releases(id),
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_artifact_assignments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artifact_release_id TEXT NOT NULL REFERENCES artifact_releases(id) ON DELETE CASCADE,
  desired_state TEXT NOT NULL DEFAULT 'active',
  rollout_strategy TEXT NOT NULL DEFAULT 'all_at_once',
  rollout_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, artifact_release_id)
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  arch TEXT NOT NULL,
  client_kind TEXT NOT NULL,
  client_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online',
  metadata_json TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS device_tools (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  detected_version TEXT,
  installed INTEGER NOT NULL DEFAULT 1,
  details_json TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (device_id, tool)
);

CREATE TABLE IF NOT EXISTS device_inventory (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (device_id)
);

CREATE TABLE IF NOT EXISTS device_artifact_states (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  artifact_release_id TEXT NOT NULL REFERENCES artifact_releases(id) ON DELETE CASCADE,
  desired_state TEXT NOT NULL DEFAULT 'active',
  actual_state TEXT NOT NULL DEFAULT 'pending',
  activation_state TEXT,
  install_root TEXT,
  wrapper_path TEXT,
  current_binding_json TEXT,
  previous_release_id TEXT REFERENCES artifact_releases(id),
  last_error_code TEXT,
  last_error_detail TEXT,
  inventory_json TEXT,
  last_verified_at TEXT,
  last_transition_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (device_id, artifact_release_id)
);

CREATE TABLE IF NOT EXISTS device_events (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  artifact_release_id TEXT REFERENCES artifact_releases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artifact_health_checks (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  artifact_release_id TEXT NOT NULL REFERENCES artifact_releases(id) ON DELETE CASCADE,
  result TEXT NOT NULL,
  duration_ms INTEGER,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  userId TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resourceType TEXT,
  resourceId TEXT,
  details TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_org_id ON artifacts(org_id);
CREATE INDEX IF NOT EXISTS idx_artifact_releases_artifact_id ON artifact_releases(artifact_id);
CREATE INDEX IF NOT EXISTS idx_assignments_profile_id ON profile_artifact_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_devices_org_id ON devices(org_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_device_states_device_id ON device_artifact_states(device_id);
CREATE INDEX IF NOT EXISTS idx_submissions_org_id ON artifact_submissions(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_org_id ON audit_log(orgId);
