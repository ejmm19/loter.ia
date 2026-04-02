import { Hono } from 'hono';
import { requireAdmin } from '../middleware/auth';

export const lotteriesRouter = new Hono<{ Bindings: Env }>();

// List all active lotteries
lotteriesRouter.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, country, pick_count, max_number, draw_schedule FROM lotteries WHERE active = 1 ORDER BY name'
  ).all();
  return c.json({ lotteries: results });
});

// Get lottery by id
lotteriesRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const lottery = await c.env.DB.prepare(
    'SELECT id, name, country, pick_count, max_number, draw_schedule, active FROM lotteries WHERE id = ?'
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
    'SELECT id, lottery_id, draw_date, numbers, special_numbers, jackpot_amount FROM draws WHERE lottery_id = ? ORDER BY draw_date DESC LIMIT ? OFFSET ?'
  ).bind(id, limit, offset).all<{ id: number; lottery_id: number; draw_date: string; numbers: string; special_numbers: string | null; jackpot_amount: number | null }>();

  const draws = results.map(row => ({
    ...row,
    numbers: JSON.parse(row.numbers) as number[],
    special_numbers: row.special_numbers ? JSON.parse(row.special_numbers) as number[] : null,
  }));

  return c.json({ draws, limit, offset });
});

// Get latest draw
lotteriesRouter.get('/:id/draws/latest', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const draw = await c.env.DB.prepare(
    'SELECT id, lottery_id, draw_date, numbers, special_numbers, jackpot_amount FROM draws WHERE lottery_id = ? ORDER BY draw_date DESC LIMIT 1'
  ).bind(id).first<{ id: number; lottery_id: number; draw_date: string; numbers: string; special_numbers: string | null; jackpot_amount: number | null }>();

  if (!draw) return c.json({ error: 'No draws found' }, 404);

  return c.json({
    draw: {
      ...draw,
      numbers: JSON.parse(draw.numbers) as number[],
      special_numbers: draw.special_numbers ? JSON.parse(draw.special_numbers) as number[] : null,
    }
  });
});

// Add a draw result (admin only)
lotteriesRouter.post('/:id/draws', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  let body: { draw_date?: string; numbers?: number[]; special_numbers?: number[]; jackpot_amount?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { draw_date, numbers, special_numbers, jackpot_amount } = body;
  if (!draw_date || !numbers?.length) {
    return c.json({ error: 'draw_date and numbers are required' }, 400);
  }

  const lottery = await c.env.DB.prepare('SELECT id FROM lotteries WHERE id = ? AND active = 1').bind(id).first();
  if (!lottery) return c.json({ error: 'Lottery not found' }, 404);

  const result = await c.env.DB.prepare(
    'INSERT INTO draws (lottery_id, draw_date, numbers, special_numbers, jackpot_amount) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, draw_date, JSON.stringify(numbers), special_numbers ? JSON.stringify(special_numbers) : null, jackpot_amount ?? null).run();

  return c.json({
    draw: {
      id: result.meta.last_row_id,
      lottery_id: id,
      draw_date,
      numbers,
      special_numbers: special_numbers ?? null,
      jackpot_amount: jackpot_amount ?? null,
    }
  }, 201);
});
