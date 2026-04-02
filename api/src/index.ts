import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { predictionsRouter } from './routes/predictions';
import { lotteriesRouter } from './routes/lotteries';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: ['http://localhost:4200', 'https://loter-ia.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.route('/api/auth', authRouter);
app.route('/api/predictions', predictionsRouter);
app.route('/api/lotteries', lotteriesRouter);

app.get('/api/health', (c) => c.json({ status: 'ok', version: '1.0.0' }));

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
