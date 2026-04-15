SELECT l.name, l.draw_day,
  (SELECT GROUP_CONCAT(DISTINCT
    CASE CAST(strftime('%w', d.draw_date) AS INTEGER)
      WHEN 0 THEN 'dom'
      WHEN 1 THEN 'lun'
      WHEN 2 THEN 'mar'
      WHEN 3 THEN 'mie'
      WHEN 4 THEN 'jue'
      WHEN 5 THEN 'vie'
      WHEN 6 THEN 'sab'
    END)
  FROM draws d WHERE d.lottery_id = l.id AND d.prize_type = 'mayor' AND d.draw_date >= '2026-01-01'
  ) as dias_reales
FROM lotteries l WHERE l.active = 1 ORDER BY l.id
