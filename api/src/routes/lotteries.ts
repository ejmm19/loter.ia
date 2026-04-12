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
    SELECT d.id, d.lottery_id, l.name, l.slug, d.draw_date, d.number, d.series, d.sorteo
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

// Get lottery by id
lotteriesRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const lottery = await c.env.DB.prepare(
    'SELECT id, slug, name, source_name, draw_day, active FROM lotteries WHERE id = ?'
  ).bind(id).first();

  if (!lottery) return c.json({ error: 'Lottery not found' }, 404);
  return c.json({ lottery });
});

// Get draws for a lottery (paginated)
lotteriesRouter.get('/:id/draws', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');

  const { results } = await c.env.DB.prepare(
    'SELECT id, lottery_id, draw_date, number, series, sorteo, prize_type FROM draws WHERE lottery_id = ? ORDER BY draw_date DESC LIMIT ? OFFSET ?'
  ).bind(id, limit, offset).all();

  return c.json({ draws: results, limit, offset });
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
