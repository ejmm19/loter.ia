import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { predictionsRouter } from './routes/predictions';
import { lotteriesRouter } from './routes/lotteries';
import { analysisRouter } from './routes/analysis';
import { ingestLotteryData } from './services/ingestion';
import { billingRouter } from './routes/billing';
import { webhookRouter } from './routes/webhook';
import { userRouter } from './routes/user';
import { sendEmail, drawResultsEmail, predictionHitEmail } from './services/email';

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
app.route('/api/analysis', analysisRouter);
app.route('/api/billing', billingRouter);
app.route('/api/stripe/webhook', webhookRouter);
app.route('/api/user', userRouter);

app.get('/api/health', (c) => c.json({ status: 'ok', version: '2.0.0' }));

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Cron handler — draw results notifications ────────────────────────────────
// Runs daily (see wrangler.toml). Sends email to subscribed users when new
// draws have been posted and checks if any predictions matched.
async function handleCron(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    console.log('Email not configured, skipping cron notifications');
    return;
  }

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const drawDate = yesterday.toISOString().split('T')[0];

  // Find draws posted yesterday
  const draws = await env.DB
    .prepare(`
      SELECT d.id, d.lottery_id, l.name AS lottery_name, d.numbers, d.draw_date
      FROM draws d
      JOIN lotteries l ON l.id = d.lottery_id
      WHERE d.draw_date = ?
    `)
    .bind(drawDate)
    .all<{ id: number; lottery_id: number; lottery_name: string; numbers: string; draw_date: string }>();

  for (const draw of draws.results ?? []) {
    const actualNumbers = JSON.parse(draw.numbers) as number[];

    // Find users subscribed to this lottery's results notifications
    const subscribers = await env.DB
      .prepare(`
        SELECT u.id, u.name, u.email
        FROM email_subscriptions es
        JOIN users u ON u.id = es.user_id
        WHERE es.lottery_id = ? AND es.notify_results = 1
      `)
      .bind(draw.lottery_id)
      .all<{ id: number; name: string; email: string }>();

    for (const user of subscribers.results ?? []) {
      try {
        const tmpl = drawResultsEmail({
          userName: user.name,
          lotteryName: draw.lottery_name,
          drawDate: draw.draw_date,
          numbers: actualNumbers,
          appUrl: env.APP_URL || 'https://loter-ia.pages.dev',
        });
        await sendEmail(env.RESEND_API_KEY, {
          from: env.FROM_EMAIL,
          to: user.email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
        });
      } catch (err) {
        console.error(`Failed to send draw results email to ${user.email}:`, err);
      }
    }

    // Update matched_count on predictions for this draw and notify on hits
    const predictions = await env.DB
      .prepare(`
        SELECT p.id, p.user_id, p.predicted_numbers,
               u.name AS user_name, u.email AS user_email,
               u.plan
        FROM predictions p
        JOIN users u ON u.id = p.user_id
        WHERE p.lottery_id = ? AND p.draw_date = ? AND p.actual_numbers IS NULL
      `)
      .bind(draw.lottery_id, draw.draw_date)
      .all<{
        id: number;
        user_id: number;
        predicted_numbers: string;
        user_name: string;
        user_email: string;
        plan: string;
      }>();

    const actualSet = new Set(actualNumbers);

    for (const pred of predictions.results ?? []) {
      const predicted = JSON.parse(pred.predicted_numbers) as number[];
      const matchedCount = predicted.filter((n) => actualSet.has(n)).length;

      await env.DB
        .prepare(`
          UPDATE predictions
          SET actual_numbers = ?, matched_count = ?, draw_id = ?
          WHERE id = ?
        `)
        .bind(JSON.stringify(actualNumbers), matchedCount, draw.id, pred.id)
        .run();

      // Send prediction hit notification if user is Pro and subscribed
      if (matchedCount > 0 && pred.plan === 'pro') {
        const notifPref = await env.DB
          .prepare(`
            SELECT notify_prediction_hit FROM email_subscriptions
            WHERE user_id = ? AND lottery_id = ?
          `)
          .bind(pred.user_id, draw.lottery_id)
          .first<{ notify_prediction_hit: number }>();

        if (notifPref?.notify_prediction_hit === 1) {
          try {
            const tmpl = predictionHitEmail({
              userName: pred.user_name,
              lotteryName: draw.lottery_name,
              drawDate: draw.draw_date,
              predictedNumbers: predicted,
              actualNumbers,
              matchedCount,
              appUrl: env.APP_URL || 'https://loter-ia.pages.dev',
            });
            await sendEmail(env.RESEND_API_KEY, {
              from: env.FROM_EMAIL,
              to: pred.user_email,
              subject: tmpl.subject,
              html: tmpl.html,
              text: tmpl.text,
            });
          } catch (err) {
            console.error(`Failed to send prediction hit email to ${pred.user_email}:`, err);
          }
        }
      }
    }
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Phase 2a: import new draw results from configured feed
    ctx.waitUntil(
      ingestLotteryData(env).catch(err =>
        console.error('[scheduled] Ingestion failed:', err)
      )
    );
    // Phase 3: send draw-result and prediction-hit emails
    await handleCron(env);
  },
};
