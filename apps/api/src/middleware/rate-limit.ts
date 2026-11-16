import { ipKeyGenerator, rateLimit, type Store } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

/** Creates a store per limiter (Redis in the app so limits hold across replicas). */
export type RateLimitStoreFactory = (prefix: string) => Store | undefined;

type LimiterOptions = {
  name: string;
  windowMs: number;
  limit: number;
  /** Also key by the request's email so one account can't be brute-forced from many IPs. */
  byEmail?: boolean;
};

export function createLimiter(
  { name, windowMs, limit, byEmail }: LimiterOptions,
  storeFactory?: RateLimitStoreFactory,
): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: storeFactory?.(`rl:${name}:`),
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req.ip ?? 'unknown');
      const body: unknown = req.body;
      const email =
        byEmail && typeof body === 'object' && body !== null && 'email' in body
          ? String(body.email).trim().toLowerCase()
          : '';
      return email ? `${ip}:${email}` : ip;
    },
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMITED', 'Too many attempts. Try again later.'));
    },
  });
}

const MINUTE = 60_000;

export function authLimiters(storeFactory?: RateLimitStoreFactory) {
  return {
    login: createLimiter(
      { name: 'login', windowMs: MINUTE, limit: 5, byEmail: true },
      storeFactory,
    ),
    sensitive: createLimiter({ name: 'auth', windowMs: 15 * MINUTE, limit: 5 }, storeFactory),
    refresh: createLimiter({ name: 'refresh', windowMs: MINUTE, limit: 30 }, storeFactory),
  };
}
