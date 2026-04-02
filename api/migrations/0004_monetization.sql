-- Migration: 0004_monetization
-- Phase 3 (EJM-29): subscriptions, favorites, email notifications, stripe events

-- ─── Subscription plans ───────────────────────────────────────────────────────
-- plan: 'free' | 'pro'
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN plan_expires_at TEXT;  -- null = free/lifetime, otherwise ISO date

-- ─── Stripe event idempotency log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,                     -- Stripe event id (evt_xxx)
  type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Email subscriptions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  notify_results INTEGER NOT NULL DEFAULT 1,   -- 1 = notify when draw results posted
  notify_prediction_hit INTEGER NOT NULL DEFAULT 1, -- 1 = notify when prediction matches
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, lottery_id)
);

-- ─── User favorite numbers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  numbers TEXT NOT NULL,    -- JSON array
  label TEXT,               -- optional user label
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Prediction outcome tracking ─────────────────────────────────────────────
-- (actual_numbers and matched_count already exist in predictions table from 0001)
-- Add draw_id FK so we can link predictions back to the draw result
ALTER TABLE predictions ADD COLUMN draw_id INTEGER REFERENCES draws(id);

-- ─── Daily prediction usage counter (for Free plan rate-limiting) ─────────────
CREATE TABLE IF NOT EXISTS prediction_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,   -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_subs_user ON email_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_subs_lottery ON email_subscriptions(lottery_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id, lottery_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_prediction_usage_user_date ON prediction_usage(user_id, usage_date);
