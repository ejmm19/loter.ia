-- Migration: 0006_missing_lotteries
-- Phase 2a (EJM-42): Add lotteries present in datos.gov.co but missing from catalog
-- Covers: Valle, Santander, Risaralda, Extra de Colombia, Cruz Roja

INSERT OR IGNORE INTO lotteries (name, country, pick_count, min_number, max_number, draw_schedule, game_type) VALUES
  ('Lotería del Valle',        'Colombia', 4, 0, 9999, 'Fridays',    'traditional'),
  ('Lotería de Santander',     'Colombia', 4, 0, 9999, 'Fridays',    'traditional'),
  ('Lotería del Risaralda',    'Colombia', 4, 0, 9999, 'Fridays',    'traditional'),
  ('Extra de Colombia',        'Colombia', 4, 0, 9999, 'Varies',     'traditional'),
  ('Cruz Roja',                'Colombia', 4, 0, 9999, 'Varies',     'traditional');
