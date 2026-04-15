import { Hono } from 'hono';
import { requireAdmin } from '../middleware/auth';

export const lotteriesRouter = new Hono<{ Bindings: Env }>();

// List all active lotteries
lotteriesRouter.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, slug, name, source_name, draw_day FROM lotteries WHERE active = 1 ORDER BY name'
  ).all();
  return c.json({ lotteries: results });
});

// Get latest draw for each lottery (for hero carousel)
lotteriesRouter.get('/latest-results', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT d.id, d.lottery_id, l.name, l.slug, d.draw_date, d.number, d.series, d.sorteo, d.prize_value
    FROM draws d
    JOIN lotteries l ON d.lottery_id = l.id
    WHERE l.active = 1
      AND d.prize_type = 'mayor'
      AND d.id = (
        SELECT d2.id FROM draws d2
        WHERE d2.lottery_id = d.lottery_id AND d2.prize_type = 'mayor'
        ORDER BY d2.draw_date DESC LIMIT 1
      )
    ORDER BY d.draw_date DESC
  `).all();
  return c.json({ results });
});

// Get the hottest digits — optionally filtered by lotteryId
lotteriesRouter.get('/hot-numbers', async (c) => {
  const lotteryId = c.req.query('lotteryId');

  let query = `SELECT number FROM draws WHERE prize_type = 'mayor'`;
  const bindings: (string | number)[] = [];

  if (lotteryId) {
    query += ' AND lottery_id = ?';
    bindings.push(Number(lotteryId));
  } else {
    query += ` AND draw_date >= date('now', '-30 days')`;
  }

  const { results } = bindings.length
    ? await c.env.DB.prepare(query).bind(...bindings).all<{ number: string }>()
    : await c.env.DB.prepare(query).all<{ number: string }>();

  const freq = new Array(10).fill(0);
  for (const row of results) {
    for (const ch of row.number) {
      const d = parseInt(ch, 10);
      if (!isNaN(d)) freq[d]++;
    }
  }

  const hotDigits = freq
    .map((count, digit) => ({ digit, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return c.json({ hotDigits, totalDraws: results.length });
});

// Check if a number+series matches a winning draw
lotteriesRouter.get('/check', async (c) => {
  const lotteryId = Number(c.req.query('lotteryId'));
  const number = c.req.query('number');
  const series = c.req.query('series');

  if (!Number.isInteger(lotteryId) || !number) {
    return c.json({ error: 'lotteryId and number are required' }, 400);
  }

  let query = `
    SELECT d.id, d.lottery_id, l.name, l.slug, d.draw_date, d.number, d.series, d.sorteo, d.prize_type
    FROM draws d
    JOIN lotteries l ON d.lottery_id = l.id
    WHERE d.lottery_id = ? AND d.number = ? AND d.prize_type = 'mayor'
  `;
  const bindings: (string | number)[] = [lotteryId, number];

  if (series) {
    query += ' AND d.series = ?';
    bindings.push(series);
  }

  query += ' ORDER BY d.draw_date DESC LIMIT 1';

  const draw = await c.env.DB.prepare(query).bind(...bindings).first();

  if (!draw) {
    return c.json({ match: false, message: 'Tu número no coincide con ningún sorteo reciente.' });
  }

  return c.json({
    match: true,
    message: '¡Felicidades! Tu número coincide con un sorteo.',
    draw,
  });
});

// Get lottery by id or slug
lotteriesRouter.get('/:idOrSlug', async (c) => {
  const param = c.req.param('idOrSlug');
  const id = Number(param);

  const lottery = Number.isInteger(id)
    ? await c.env.DB.prepare('SELECT id, slug, name, source_name, draw_day, active FROM lotteries WHERE id = ?').bind(id).first()
    : await c.env.DB.prepare('SELECT id, slug, name, source_name, draw_day, active FROM lotteries WHERE slug = ?').bind(param).first();

  if (!lottery) return c.json({ error: 'Lottery not found' }, 404);
  return c.json({ lottery });
});

// Get draws for a lottery (paginated, mayor only, with secos count)
lotteriesRouter.get('/:id/draws', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');

  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.lottery_id, d.draw_date, d.number, d.series, d.sorteo, d.prize_type,
       (SELECT COUNT(*) FROM draws s WHERE s.lottery_id = d.lottery_id AND s.draw_date = d.draw_date AND s.prize_type = 'seco') as secos_count
     FROM draws d
     WHERE d.lottery_id = ? AND d.prize_type = 'mayor'
     ORDER BY d.draw_date DESC LIMIT ? OFFSET ?`
  ).bind(id, limit, offset).all();

  return c.json({ draws: results, limit, offset });
});

// Get a single mayor draw by date
lotteriesRouter.get('/:id/draws/by-date', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const drawDate = c.req.query('date');
  if (!drawDate) return c.json({ error: 'date query param is required' }, 400);

  const draw = await c.env.DB.prepare(
    "SELECT id, lottery_id, draw_date, number, series, sorteo, prize_type, prize_name, prize_value FROM draws WHERE lottery_id = ? AND draw_date = ? AND prize_type = 'mayor' LIMIT 1"
  ).bind(id, drawDate).first();

  if (!draw) return c.json({ error: 'Draw not found' }, 404);
  return c.json({ draw });
});

// Get secos for a specific lottery and draw date
lotteriesRouter.get('/:id/draws/secos', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const drawDate = c.req.query('date');
  if (!drawDate) return c.json({ error: 'date query param is required' }, 400);

  const { results } = await c.env.DB.prepare(
    "SELECT id, number, series, sorteo, prize_name, prize_value FROM draws WHERE lottery_id = ? AND draw_date = ? AND prize_type = 'seco' ORDER BY prize_value DESC, number"
  ).bind(id, drawDate).all();

  return c.json({ secos: results });
});

// Get latest draw for a specific lottery
lotteriesRouter.get('/:id/draws/latest', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const draw = await c.env.DB.prepare(
    "SELECT id, lottery_id, draw_date, number, series, sorteo, prize_type FROM draws WHERE lottery_id = ? AND prize_type = 'mayor' ORDER BY draw_date DESC LIMIT 1"
  ).bind(id).first();

  if (!draw) return c.json({ error: 'No draws found' }, 404);
  return c.json({ draw });
});

// Add a draw result (admin only)
lotteriesRouter.post('/:id/draws', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  let body: { draw_date?: string; number?: string; series?: string; sorteo?: number; prize_type?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { draw_date, number, series, sorteo, prize_type = 'mayor' } = body;
  if (!draw_date || !number) {
    return c.json({ error: 'draw_date and number are required' }, 400);
  }

  const lottery = await c.env.DB.prepare('SELECT id FROM lotteries WHERE id = ? AND active = 1').bind(id).first();
  if (!lottery) return c.json({ error: 'Lottery not found' }, 404);

  const result = await c.env.DB.prepare(
    'INSERT INTO draws (lottery_id, draw_date, number, series, sorteo, prize_type) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, draw_date, number, series ?? null, sorteo ?? null, prize_type).run();

  return c.json({
    draw: {
      id: result.meta.last_row_id,
      lottery_id: id,
      draw_date,
      number,
      series: series ?? null,
      sorteo: sorteo ?? null,
      prize_type,
    }
  }, 201);
});
