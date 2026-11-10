import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { config } from './config.js';

const cookieName = 'claw_host_session';
const sessionLifetimeSeconds = 8 * 60 * 60;
const loginSchema = z.object({ pin: z.string().min(1).max(128) });

function signature(expiresAt: string) {
  return createHmac('sha256', config.sessionSecret).update(expiresAt).digest('base64url');
}

function hasValidSession(req: Request) {
  const value = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!value) return false;

  const [expiresAt, providedSignature] = value.split('.');
  if (!expiresAt || !providedSignature || !/^\d+$/.test(expiresAt) || Number(expiresAt) <= Date.now() / 1000) {
    return false;
  }

  const expected = Buffer.from(signature(expiresAt));
  const actual = Buffer.from(providedSignature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function requireHost(req: Request, res: Response, next: NextFunction) {
  if (!hasValidSession(req)) {
    res.status(401).json({ message: 'Please enter the host PIN to continue.' });
    return;
  }
  next();
}

export const authRouter = express.Router();

authRouter.get('/session', (req, res) => {
  res.json({ authenticated: hasValidSession(req) });
});

authRouter.post('/login', (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Enter the host PIN.' });
    return;
  }

  const expected = createHash('sha256').update(config.hostPin).digest();
  const actual = createHash('sha256').update(result.data.pin).digest();
  if (!timingSafeEqual(expected, actual)) {
    res.status(401).json({ message: 'That host PIN is not correct.' });
    return;
  }

  const expiresAt = String(Math.floor(Date.now() / 1000) + sessionLifetimeSeconds);
  res.cookie(cookieName, `${expiresAt}.${signature(expiresAt)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    maxAge: sessionLifetimeSeconds * 1000,
    path: '/',
  });
  res.json({ authenticated: true });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    path: '/',
  });
  res.json({ authenticated: false });
});
