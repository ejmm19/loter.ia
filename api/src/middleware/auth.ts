import { Context, Next } from 'hono';
import { verifyJwt, JwtPayload } from '../services/auth';

export type AuthContext = {
  Variables: {
    user: JwtPayload;
  };
};

export async function requireAuth(c: Context<{ Bindings: Env; Variables: { user: JwtPayload } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (payload.type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401);
    }
    c.set('user', payload);
    return next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

export async function requireAdmin(c: Context<{ Bindings: Env; Variables: { user: JwtPayload } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (payload.type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401);
    }
    if (payload.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    c.set('user', payload);
    return next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

export async function optionalAuth(c: Context<{ Bindings: Env; Variables: { user: JwtPayload } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyJwt(token, c.env.JWT_SECRET);
      if (payload.type === 'access') {
        c.set('user', payload);
      }
    } catch {
      // Invalid/expired token — continue as anonymous
    }
  }
  return next();
}
