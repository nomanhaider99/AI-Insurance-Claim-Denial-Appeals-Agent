import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { CSRF_COOKIE } from '../lib/cookies.js';
import { safeEqual } from '../lib/tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF check for every state-changing request:
 * the X-CSRF-Token header must equal the csrf_token cookie, and a browser-sent
 * Origin/Referer must match the web origin.
 */
export function csrfProtection(webOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin') ?? refererOrigin(req.get('referer'));
    if (origin && origin !== webOrigin) {
      throw new AppError('FORBIDDEN', 'Cross-site request blocked', { reason: 'csrf' });
    }

    const cookie: unknown = req.cookies?.[CSRF_COOKIE];
    const header = req.get('x-csrf-token');
    if (typeof cookie !== 'string' || !header || !safeEqual(cookie, header)) {
      throw new AppError('FORBIDDEN', 'Invalid CSRF token', { reason: 'csrf' });
    }
    next();
  };
}

function refererOrigin(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
