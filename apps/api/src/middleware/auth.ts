import type { Request, RequestHandler } from 'express';
import type { Role } from '@appeal/shared';
import { AppError } from '../lib/errors.js';
import { ACCESS_COOKIE } from '../lib/cookies.js';
import { verifyAccessToken, type AuthContext } from '../lib/tokens.js';

/** Verifies the access-token cookie and sets req.auth. 401 otherwise. */
export function requireAuth(secret: string): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[ACCESS_COOKIE];
    const auth = typeof token === 'string' ? await verifyAccessToken(token, secret) : null;
    if (!auth) throw new AppError('UNAUTHORIZED', 'Authentication required');
    req.auth = auth;
    next();
  };
}

/** Must run after requireAuth. 403 unless the caller has one of `roles`. */
export function requireRole(...roles: readonly Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw new AppError('UNAUTHORIZED', 'Authentication required');
    if (!roles.includes(req.auth.role)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to do this');
    }
    next();
  };
}

/** Typed accessor for handlers mounted behind requireAuth. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.auth;
}
