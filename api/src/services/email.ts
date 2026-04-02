/**
 * Email service — Resend API
 *
 * Resend works natively in Cloudflare Workers via fetch().
 * https://resend.com/docs/send-with-workers
 */

interface EmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface ResendResponse {
  id: string;
}

export async function sendEmail(
  apiKey: string,
  payload: EmailPayload
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export function drawResultsEmail(opts: {
  userName: string;
  lotteryName: string;
  drawDate: string;
  numbers: number[];
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const nums = opts.numbers.join(' · ');
  return {
    subject: `Resultados ${opts.lotteryName} — ${opts.drawDate}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#6d28d9">🎱 Resultados del sorteo</h2>
        <p>Hola ${escapeHtml(opts.userName)},</p>
        <p>Los resultados de <strong>${escapeHtml(opts.lotteryName)}</strong>
        del <strong>${escapeHtml(opts.drawDate)}</strong>:</p>
        <div style="font-size:2rem;text-align:center;padding:16px;
                    background:#f5f3ff;border-radius:12px;letter-spacing:8px">
          ${nums}
        </div>
        <p style="margin-top:24px">
          <a href="${opts.appUrl}/predictions"
             style="background:#6d28d9;color:#fff;padding:12px 24px;
                    border-radius:8px;text-decoration:none">
            Ver mis predicciones
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:32px">
          Recibes este correo porque estás suscrito a notificaciones de loter.ia.<br>
          <a href="${opts.appUrl}/dashboard">Gestionar preferencias</a>
        </p>
      </div>`,
    text: `Resultados ${opts.lotteryName} (${opts.drawDate}): ${nums}\n\nVer predicciones: ${opts.appUrl}/predictions`,
  };
}

export function predictionHitEmail(opts: {
  userName: string;
  lotteryName: string;
  drawDate: string;
  predictedNumbers: number[];
  actualNumbers: number[];
  matchedCount: number;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const predicted = opts.predictedNumbers.join(' · ');
  const actual = opts.actualNumbers.join(' · ');
  return {
    subject: `🎉 ¡Acertaste ${opts.matchedCount} número${opts.matchedCount !== 1 ? 's' : ''}! — ${opts.lotteryName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#059669">🎉 ¡Predicción acertada!</h2>
        <p>Hola ${escapeHtml(opts.userName)},</p>
        <p>Tu predicción para <strong>${escapeHtml(opts.lotteryName)}</strong>
        del <strong>${escapeHtml(opts.drawDate)}</strong>
        acertó <strong>${opts.matchedCount} número${opts.matchedCount !== 1 ? 's' : ''}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:8px;color:#888">Tu predicción:</td>
            <td style="padding:8px;font-family:monospace">${predicted}</td>
          </tr>
          <tr style="background:#f0fdf4">
            <td style="padding:8px;color:#065f46;font-weight:bold">Resultado:</td>
            <td style="padding:8px;font-family:monospace;font-weight:bold">${actual}</td>
          </tr>
        </table>
        <p style="margin-top:24px">
          <a href="${opts.appUrl}/dashboard"
             style="background:#059669;color:#fff;padding:12px 24px;
                    border-radius:8px;text-decoration:none">
            Ver mi historial
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:32px">
          <a href="${opts.appUrl}/dashboard">Gestionar preferencias</a>
        </p>
      </div>`,
    text: `¡Acertaste ${opts.matchedCount} número(s) en ${opts.lotteryName} (${opts.drawDate})!\nTu predicción: ${predicted}\nResultado: ${actual}\n\nVer historial: ${opts.appUrl}/dashboard`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
