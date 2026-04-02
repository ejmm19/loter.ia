// Auth service — Web Crypto API only (Cloudflare Workers runtime)

export interface JwtPayload {
  sub: string;    // user id
  email: string;
  role: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

const ACCESS_TOKEN_TTL = 15 * 60;       // 15 minutes
const REFRESH_TOKEN_TTL = 7 * 24 * 3600; // 7 days

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - str.length % 4) % 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw', keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'> & { type: 'access' | 'refresh' }, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = payload.type === 'access' ? ACCESS_TOKEN_TTL : REFRESH_TOKEN_TTL;
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttl };

  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(new TextEncoder().encode(JSON.stringify(full)));
  const msg = `${header}.${body}`;

  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return `${msg}.${base64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [header, body, sig] = parts;
  const msg = `${header}.${body}`;
  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, base64urlDecode(sig), new TextEncoder().encode(msg));
  if (!valid) throw new Error('Invalid token signature');

  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as JwtPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return `${salt}:${base64url(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return base64url(bits) === hash;
}

export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return base64url(digest);
}
