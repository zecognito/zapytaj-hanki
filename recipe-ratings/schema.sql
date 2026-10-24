CREATE TABLE IF NOT EXISTS recipe_votes (
  slug TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slug, voter_hash)
);
CREATE INDEX IF NOT EXISTS recipe_votes_slug ON recipe_votes(slug);
CREATE TABLE IF NOT EXISTS recipe_rating_limits (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, ip_hash)
);
