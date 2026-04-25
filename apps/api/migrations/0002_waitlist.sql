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
