import { Hono } from 'hono';
import { signJwt, verifyJwt, hashPassword, verifyPassword, hashRefreshToken } from '../services/auth';
import { requireAuth } from '../middleware/auth';

export const authRouter = new Hono<{ Bindings: Env }>();

authRouter.post('/register', async (c) => {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password, name } = body;
  if (!email || !password || !name) {
    return c.json({ error: 'email, password and name are required' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
  ).bind(email.toLowerCase(), passwordHash, name).run();

  const userId = String(result.meta.last_row_id);

  const [accessToken, refreshToken] = await Promise.all([
    signJwt({ sub: userId, email: email.toLowerCase(), role: 'user', type: 'access' }, c.env.JWT_SECRET),
    signJwt({ sub: userId, email: email.toLowerCase(), role: 'user', type: 'refresh' }, c.env.JWT_SECRET),
  ]);

  const tokenHash = await hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(userId, tokenHash, expiresAt).run();

  return c.json({
    user: { id: userId, email: email.toLowerCase(), name, role: 'user' },
    accessToken,
    refreshToken,
  }, 201);
});

authRouter.post('/login', async (c) => {
  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password } = body;
  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first<{ id: number; email: string; password_hash: string; name: string; role: string; is_active: number }>();

  if (!user || !user.is_active) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const userId = String(user.id);
  const [accessToken, refreshToken] = await Promise.all([
    signJwt({ sub: userId, email: user.email, role: user.role ?? 'user', type: 'access' }, c.env.JWT_SECRET),
    signJwt({ sub: userId, email: user.email, role: user.role ?? 'user', type: 'refresh' }, c.env.JWT_SECRET),
  ]);

  const tokenHash = await hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(userId, tokenHash, expiresAt).run();

  return c.json({
    user: { id: userId, email: user.email, name: user.name, role: user.role ?? 'user' },
    accessToken,
    refreshToken,
  });
});

authRouter.post('/refresh', async (c) => {
  let body: { refreshToken?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.refreshToken) {
    return c.json({ error: 'refreshToken is required' }, 400);
  }

  let payload;
  try {
    payload = await verifyJwt(body.refreshToken, c.env.JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Wrong token type');
  } catch {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }

  const tokenHash = await hashRefreshToken(body.refreshToken);
  const stored = await c.env.DB.prepare(
    "SELECT id FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')"
  ).bind(tokenHash).first<{ id: number }>();

  if (!stored) {
    return c.json({ error: 'Refresh token revoked or expired' }, 401);
  }

  await c.env.DB.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?").bind(stored.id).run();

  const user = await c.env.DB.prepare(
    'SELECT id, email, role FROM users WHERE id = ? AND is_active = 1'
  ).bind(payload.sub).first<{ id: number; email: string; role: string }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  const userId = String(user.id);
  const [accessToken, newRefreshToken] = await Promise.all([
    signJwt({ sub: userId, email: user.email, role: user.role ?? 'user', type: 'access' }, c.env.JWT_SECRET),
    signJwt({ sub: userId, email: user.email, role: user.role ?? 'user', type: 'refresh' }, c.env.JWT_SECRET),
  ]);

  const newTokenHash = await hashRefreshToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(userId, newTokenHash, expiresAt).run();

  return c.json({ accessToken, refreshToken: newRefreshToken });
});

authRouter.post('/logout', requireAuth, async (c) => {
  let body: { refreshToken?: string };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  if (body.refreshToken) {
    const tokenHash = await hashRefreshToken(body.refreshToken);
    await c.env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?"
    ).bind(tokenHash).run();
  }

  return c.json({ message: 'Logged out' });
});

authRouter.get('/me', requireAuth, async (c) => {
  const jwtUser = c.get('user');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, created_at FROM users WHERE id = ?'
  ).bind(jwtUser.sub).first<{ id: number; email: string; name: string; role: string; created_at: string }>();

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user: { ...user, id: String(user.id) } });
});
