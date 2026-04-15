import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { predictionsRouter } from './routes/predictions';
import { lotteriesRouter } from './routes/lotteries';
import { analysisRouter } from './routes/analysis';
import { ingestLotteryData } from './services/ingestion';
import { userRouter } from './routes/user';
import { dreamsRouter } from './routes/dreams';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: ['http://localhost:4200', 'https://loter-ia.pages.dev', 'https://loteriasdehoy.pages.dev', 'https://loteriasdehoy.pro', 'https://www.loteriasdehoy.pro'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.route('/api/auth', authRouter);
app.route('/api/predictions', predictionsRouter);
app.route('/api/lotteries', lotteriesRouter);
app.route('/api/analysis', analysisRouter);
app.route('/api/user', userRouter);
app.route('/api/dreams', dreamsRouter);

app.get('/api/health', (c) => c.json({ status: 'ok', version: '2.0.0' }));

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      ingestLotteryData(env).catch(err =>
        console.error('[scheduled] Ingestion failed:', err)
      )
    );
  },
};
