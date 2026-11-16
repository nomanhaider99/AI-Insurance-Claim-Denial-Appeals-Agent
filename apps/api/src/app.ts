import express, { Router, type Express } from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config.js';
import type { Db } from './db/client.js';
import type { Mailer } from './lib/mailer.js';
import { logger, reqSerializer } from './logger.js';
import { healthRouter, type HealthChecks } from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { csrfProtection } from './middleware/csrf.js';
import { requireAuth } from './middleware/auth.js';
import { auditRequests } from './middleware/audit-requests.js';
import { authLimiters, type RateLimitStoreFactory } from './middleware/rate-limit.js';
import { authRouter } from './features/auth/auth.routes.js';
import { authService } from './features/auth/auth.service.js';
import { orgRouter } from './features/org/org.routes.js';
import { orgService } from './features/org/org.service.js';

export type AppDeps = {
  db: Db;
  config: AppConfig;
  mailer: Mailer;
  healthChecks: HealthChecks;
  /** Shared rate-limit store (Redis in the app). Omitted in tests: in-memory per app. */
  rateLimitStore?: RateLimitStoreFactory;
  /** Extra routes mounted under /api/v1 after the built-in ones (tests). */
  extraRoutes?: Router;
};

export function createApp(deps: AppDeps): Express {
  const { db, config, mailer } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(
    pinoHttp({
      logger,
      serializers: { req: reqSerializer },
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter(deps.healthChecks));

  const auth = requireAuth({ secret: config.jwtAccessSecret, db });
  const api = Router();
  api.use(csrfProtection(config.webOrigin));
  api.use(auditRequests(db));
  api.use(
    '/auth',
    authRouter({
      service: authService({ db, config, mailer }),
      config,
      limiters: authLimiters(deps.rateLimitStore),
      requireAuth: auth,
    }),
  );
  api.use('/org', orgRouter({ service: orgService({ db, config, mailer }), requireAuth: auth }));
  if (deps.extraRoutes) api.use(deps.extraRoutes);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
