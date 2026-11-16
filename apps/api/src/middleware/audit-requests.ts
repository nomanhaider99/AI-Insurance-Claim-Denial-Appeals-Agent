import type { RequestHandler } from 'express';
import type { Db } from '../db/client.js';
import { audit } from '../lib/audit.js';
import { logger } from '../logger.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes an audit row for every authenticated state-changing request once it finishes.
 * Services add semantic rows (e.g. "user.role_changed") on top of this.
 * Records the route pattern, never the body.
 */
export function auditRequests(db: Db): RequestHandler {
  return (req, res, next) => {
    if (!MUTATING.has(req.method)) return next();
    res.on('finish', () => {
      if (!req.auth) return;
      const route = `${req.baseUrl}${typeof req.route?.path === 'string' ? req.route.path : ''}`;
      audit(
        db,
        { orgId: req.auth.orgId, userId: req.auth.userId, ip: req.ip },
        `http.${req.method.toLowerCase()}`,
        { type: 'route' },
        { route, status: res.statusCode },
      ).catch((err: unknown) => logger.error({ err }, 'audit write failed'));
    });
    next();
  };
}
