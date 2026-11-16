import express, { type Express, type Router } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { healthRouter, type HealthChecks } from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export type AppDeps = {
  healthChecks: HealthChecks;
  webOrigin: string;
  /** Feature routes, mounted under /api/v1 (Phase 2+). */
  apiRouter?: Router;
};

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );
  // Minimal CORS for the web app; replaced by a full cookie/CSRF-aware setup in Phase 2.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', deps.webOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE');
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter(deps.healthChecks));
  if (deps.apiRouter) app.use('/api/v1', deps.apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
