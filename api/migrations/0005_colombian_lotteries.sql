-- Migration: 0004_colombian_lotteries
-- Phase 2a (EJM-27): Extended lottery model for Colombian/LatAm lotteries
-- Adds game_type and min_number fields; seeds Colombian lotteries

ALTER TABLE lotteries ADD COLUMN game_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE lotteries ADD COLUMN min_number INTEGER NOT NULL DEFAULT 1;

-- Correct existing Colombian entries
UPDATE lotteries SET game_type = 'traditional', min_number = 0, max_number = 9999, pick_count = 4
  WHERE name = 'Lotería Nacional' AND country = 'Colombia';
UPDATE lotteries SET game_type = 'baloto', min_number = 1
  WHERE name = 'Baloto' AND country = 'Colombia';

-- Core Colombian lotteries
INSERT OR IGNORE INTO lotteries (name, country, pick_count, min_number, max_number, draw_schedule, game_type) VALUES
  ('Chance Cundinamarca',    'Colombia', 4, 0, 9999, 'Daily (multiple)',   'chance'),
  ('Lotería de Bogotá',      'Colombia', 4, 0, 9999, 'Thursdays',         'traditional'),
  ('Lotería de Medellín',    'Colombia', 4, 0, 9999, 'Fridays',           'traditional'),
  ('Lotería del Meta',       'Colombia', 4, 0, 9999, 'Fridays',           'traditional'),
  ('Lotería de Boyacá',      'Colombia', 4, 0, 9999, 'Saturdays',         'traditional'),
  ('Lotería del Tolima',     'Colombia', 4, 0, 9999, 'Mondays',           'traditional'),
  ('Lotería de Cundinamarca','Colombia', 4, 0, 9999, 'Mondays',           'traditional'),
  ('Lotería del Huila',      'Colombia', 4, 0, 9999, 'Wednesdays',        'traditional'),
  ('Lotería del Cauca',      'Colombia', 4, 0, 9999, 'Saturdays',         'traditional'),
  ('Lotería de Caldas',      'Colombia', 4, 0, 9999, 'Saturdays',         'traditional'),
  ('Lotería de Manizales',   'Colombia', 4, 0, 9999, 'Wednesdays',        'traditional'),
  ('Lotería del Quindío',    'Colombia', 4, 0, 9999, 'Thursdays',         'traditional'),
  ('SuperAstro',             'Colombia', 2, 0, 99,   'Daily',             'superastro'),
  ('Baloto Revancha',        'Colombia', 5, 1, 43,   'Wednesdays, Saturdays', 'baloto'),
  ('La Greca',               'Colombia', 3, 0, 999,  'Daily',             'chance');

-- LatAm additions
INSERT OR IGNORE INTO lotteries (name, country, pick_count, min_number, max_number, draw_schedule, game_type) VALUES
  ('Lotería Nacional',       'Mexico',   5, 0,    9999, 'Wednesdays, Sundays', 'traditional'),
  ('Melate',                 'Mexico',   6, 1,    56,   'Tuesdays, Thursdays, Sundays', 'standard'),
  ('La Quiniela',            'Argentina',15,0,    13,   'Saturdays',           'quiniela'),
  ('Lotería Nacional',       'Argentina',1, 0,    9999, 'Fri, Sat',            'traditional');

-- Index to speed up game_type queries used by the ingestion worker
CREATE INDEX IF NOT EXISTS idx_lotteries_game_type ON lotteries(game_type, active);
