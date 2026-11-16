import { Router } from 'express';
import type { ReadinessResponse } from '@appeal/shared';

type CheckName = keyof ReadinessResponse['checks'];
export type HealthChecks = Record<CheckName, () => Promise<void>>;

export function healthRouter(checks: HealthChecks): Router {
  const router = Router();

  /** Liveness: the process is up. No dependency calls. */
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /** Readiness: every dependency answers. 503 if any fails. */
  router.get('/health/ready', async (_req, res) => {
    const names = Object.keys(checks) as CheckName[];
    const results = await Promise.allSettled(names.map((n) => withTimeout(checks[n](), 2000)));
    const statuses = Object.fromEntries(
      names.map((n, i) => [n, results[i]?.status === 'fulfilled' ? 'ok' : 'error']),
    ) as ReadinessResponse['checks'];
    const body: ReadinessResponse = {
      status: Object.values(statuses).every((s) => s === 'ok') ? 'ok' : 'degraded',
      checks: statuses,
    };
    res.status(body.status === 'ok' ? 200 : 503).json(body);
  });

  return router;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref()),
  ]);
}
