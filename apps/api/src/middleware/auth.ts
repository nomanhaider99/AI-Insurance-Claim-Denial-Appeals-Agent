import type { Request, RequestHandler } from 'express';
import type { Role } from '@appeal/shared';
import type { Db } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { ACCESS_COOKIE } from '../lib/cookies.js';
import { verifyAccessToken, type AuthContext } from '../lib/tokens.js';
import { usersRepository } from '../features/users/users.repository.js';

/**
 * Verifies the access-token cookie, then re-reads the user (scoped by the token's org):
 * - deleted users are rejected,
 * - the **current** DB role is used, so a demotion takes effect on the next request,
 * - tokens from before a password reset (older `session_version`) are rejected.
 * Sets req.auth. 401 otherwise.
 */
export function requireAuth(deps: { secret: string; db: Db }): RequestHandler {
  const users = usersRepository(deps.db);
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[ACCESS_COOKIE];
    const claims = typeof token === 'string' ? await verifyAccessToken(token, deps.secret) : null;
    if (!claims) throw new AppError('UNAUTHORIZED', 'Authentication required');

    const user = await users.findById(claims.orgId, claims.userId);
    if (!user || user.sessionVersion !== claims.sessionVersion) {
      throw new AppError('UNAUTHORIZED', 'Authentication required');
    }
    req.auth = { userId: user.id, orgId: user.orgId, role: user.role };
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
