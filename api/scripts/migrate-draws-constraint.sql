CREATE TABLE draws_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id),
  draw_date TEXT NOT NULL,
  number TEXT NOT NULL,
  series TEXT,
  sorteo INTEGER,
  prize_type TEXT NOT NULL DEFAULT 'mayor',
  source TEXT NOT NULL DEFAULT 'datos.gov.co',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_id, draw_date, prize_type, number)
);
INSERT INTO draws_new SELECT * FROM draws;
DROP TABLE draws;
ALTER TABLE draws_new RENAME TO draws;
