-- Cloudflare D1 schema for hype counters
CREATE TABLE IF NOT EXISTS event_hype (
  event_id TEXT PRIMARY KEY,
  hype_count INTEGER NOT NULL DEFAULT 0,
  last_title TEXT,
  last_theatre TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
