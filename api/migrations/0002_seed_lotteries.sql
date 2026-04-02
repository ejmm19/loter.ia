-- Migration: 0002_seed_lotteries
-- Additional seed lotteries (Spanish / European)

INSERT OR IGNORE INTO lotteries (name, country, pick_count, max_number, draw_schedule) VALUES
  ('EuroMillones', 'EU', 5, 50, 'Tuesdays, Fridays'),
  ('La Primitiva', 'ES', 6, 49, 'Thursdays, Saturdays'),
  ('Bonoloto', 'ES', 6, 49, 'Mon-Fri'),
  ('El Gordo de la Primitiva', 'ES', 5, 54, 'Sundays'),
  ('EuroDreams', 'EU', 6, 40, 'Mondays, Thursdays');
