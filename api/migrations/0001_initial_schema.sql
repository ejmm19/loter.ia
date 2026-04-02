-- Initial D1 schema for loter.ia
-- Phase 1 (EJM-26): users, lotteries, draws tables
-- Phase 2b (EJM-28): predictions, predictions_cache tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lotteries table
CREATE TABLE IF NOT EXISTS lotteries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  pick_count INTEGER NOT NULL,       -- how many numbers drawn (e.g. 6)
  max_number INTEGER NOT NULL,       -- max ball value (e.g. 49)
  draw_schedule TEXT,                -- cron expression or description
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Draws table (historical results)
CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id),
  draw_date TEXT NOT NULL,           -- YYYY-MM-DD
  numbers TEXT NOT NULL,             -- JSON array e.g. [3, 14, 22, 35, 41, 48]
  special_numbers TEXT,              -- JSON array for bonus balls, powerball, etc.
  jackpot_amount INTEGER,            -- in cents
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_id, draw_date)
);

-- Predictions history (per user)
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id),
  predicted_numbers TEXT NOT NULL,   -- JSON array
  confidence_score INTEGER,          -- 1-100
  ai_reasoning TEXT,                 -- OpenAI explanation if used
  draw_date TEXT,                    -- which draw was this for (nullable = next draw)
  actual_numbers TEXT,               -- filled in after draw occurs
  matched_count INTEGER,             -- how many matched (filled post-draw)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AI predictions cache (to limit OpenAI API calls)
CREATE TABLE IF NOT EXISTS predictions_cache (
  cache_key TEXT PRIMARY KEY,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id),
  user_id INTEGER REFERENCES users(id),
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_draws_lottery_date ON draws(lottery_id, draw_date DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_lottery ON predictions(lottery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_lottery ON predictions_cache(lottery_id, created_at DESC);

-- Seed some common lotteries
INSERT OR IGNORE INTO lotteries (name, country, pick_count, max_number, draw_schedule) VALUES
  ('Lotería Nacional', 'Colombia', 3, 9999, 'Saturdays'),
  ('Baloto', 'Colombia', 5, 43, 'Wednesdays, Saturdays'),
  ('EuroMillions', 'Europe', 5, 50, 'Tuesdays, Fridays'),
  ('Powerball', 'USA', 5, 69, 'Mondays, Wednesdays, Saturdays'),
  ('Mega Millions', 'USA', 5, 70, 'Tuesdays, Fridays');
