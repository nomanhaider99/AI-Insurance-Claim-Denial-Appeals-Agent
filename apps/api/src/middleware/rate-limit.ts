import { ipKeyGenerator, rateLimit, type Store } from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

/** Creates a store per limiter (Redis in the app so limits hold across replicas). */
export type RateLimitStoreFactory = (prefix: string) => Store | undefined;

type KeyBy = 'ip' | 'email';

/**
 * `req.ip` is only trustworthy when TRUST_PROXY matches the proxies that append
 * X-Forwarded-For (see env.ts). Email-keyed limits don't depend on it.
 */
function keyOf(req: Request, by: KeyBy): string {
  if (by === 'ip') return ipKeyGenerator(req.ip ?? 'unknown');
  const body: unknown = req.body;
  const email =
    typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';
  // No email in the body: fall back to IP so the request is still limited.
  return email ? `email:${email}` : ipKeyGenerator(req.ip ?? 'unknown');
}

export function createLimiter(
  opts: { name: string; windowMs: number; limit: number; by: KeyBy },
  storeFactory?: RateLimitStoreFactory,
): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: storeFactory?.(`rl:${opts.name}:`),
    keyGenerator: (req) => keyOf(req, opts.by),
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMITED', 'Too many attempts. Try again later.'));
    },
  });
}

const MINUTE = 60_000;

/**
 * Login has two independent limits: per IP (stops one source spraying many accounts)
 * and per email (stops many sources hammering one account). Every other sensitive
 * route gets its own bucket, so heavy use of one doesn't block the others.
 */
export function authLimiters(storeFactory?: RateLimitStoreFactory) {
  const make = (name: string, windowMs: number, limit: number, by: KeyBy = 'ip') =>
    createLimiter({ name, windowMs, limit, by }, storeFactory);
  return {
    login: [make('login-ip', MINUTE, 20), make('login-email', 15 * MINUTE, 10, 'email')],
    register: make('register', 15 * MINUTE, 10),
    forgot: [make('forgot-ip', 15 * MINUTE, 10), make('forgot-email', 15 * MINUTE, 3, 'email')],
    reset: make('reset', 15 * MINUTE, 10),
    invite: make('invite-accept', 15 * MINUTE, 10),
    refresh: make('refresh', MINUTE, 60),
  };
}
