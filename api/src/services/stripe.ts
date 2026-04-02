/**
 * Stripe service — Cloudflare Workers compatible
 *
 * Uses Web Crypto API for webhook signature verification.
 * Does NOT use the Stripe SDK (incompatible with edge runtime).
 * All Stripe API calls go via fetch().
 */

export type PlanId = 'free' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;          // USD cents / month
  predictionsPerDay: number | null;  // null = unlimited
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    predictionsPerDay: 3,
    features: [
      'Análisis estadístico básico',
      '3 predicciones por día',
      'Historial de 30 días',
      'Lotería Nacional y Baloto',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 999,            // $9.99 USD / month
    predictionsPerDay: null,
    features: [
      'Análisis estadístico avanzado + IA',
      'Predicciones ilimitadas',
      'Historial completo',
      'Todas las loterías',
      'Notificaciones por email',
      'Números favoritos ilimitados',
      'Dashboard personal con estadísticas',
    ],
  },
};

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify a Stripe webhook signature using the Web Crypto API.
 * Stripe signs requests with HMAC-SHA256.
 * https://stripe.com/docs/webhooks/signatures
 */
export async function verifyStripeSignature(
  body: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<boolean> {
  // Stripe-Signature: t=...,v1=...,v0=...
  const parts: Record<string, string[]> = {};
  for (const part of signatureHeader.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    if (!parts[k]) parts[k] = [];
    parts[k].push(v);
  }

  const timestamp = parts['t']?.[0];
  const signatures = parts['v1'] ?? [];

  if (!timestamp || signatures.length === 0) return false;

  // Reject if timestamp is >5 minutes old
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedSig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload)
  );
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some((sig) => sig === expectedHex);
}

// ─── Stripe API calls ─────────────────────────────────────────────────────────

async function stripeRequest<T>(
  method: string,
  path: string,
  secretKey: string,
  body?: Record<string, string>
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (body) {
    init.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  if (!res.ok) {
    const err = await res.json<{ error: { message: string } }>();
    throw new Error(`Stripe error: ${err.error?.message ?? res.statusText}`);
  }
  return res.json<T>();
}

interface StripeCustomer {
  id: string;
  email: string;
}

interface StripeCheckoutSession {
  id: string;
  url: string;
}

interface StripeSubscription {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  customer: string;
}

interface StripeBillingPortalSession {
  id: string;
  url: string;
}

export async function getOrCreateCustomer(
  secretKey: string,
  email: string,
  existingCustomerId?: string | null
): Promise<StripeCustomer> {
  if (existingCustomerId) {
    return stripeRequest<StripeCustomer>('GET', `/customers/${existingCustomerId}`, secretKey);
  }
  return stripeRequest<StripeCustomer>('POST', '/customers', secretKey, { email });
}

export async function createCheckoutSession(
  secretKey: string,
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>('POST', '/checkout/sessions', secretKey, {
    customer: customerId,
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function createBillingPortalSession(
  secretKey: string,
  customerId: string,
  returnUrl: string
): Promise<StripeBillingPortalSession> {
  return stripeRequest<StripeBillingPortalSession>('POST', '/billing_portal/sessions', secretKey, {
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function cancelSubscription(
  secretKey: string,
  subscriptionId: string
): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>('DELETE', `/subscriptions/${subscriptionId}`, secretKey);
}
