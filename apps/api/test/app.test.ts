import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { z } from 'zod';
import { apiErrorSchema, readinessResponseSchema } from '@appeal/shared';
import { AppError } from '../src/lib/errors.js';
import type { Db } from '../src/db/client.js';
import type { HealthChecks } from '../src/routes/health.js';
import { createTestDb, healthyChecks, makeApp } from './helpers.js';

const fail = async () => {
  throw new Error('down');
};

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const make = (healthChecks: HealthChecks = healthyChecks) => makeApp(db, { healthChecks });

describe('health', () => {
  it('GET /health returns ok without touching dependencies', async () => {
    const res = await request(make({ database: fail, redis: fail, storage: fail })).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 200 when all dependencies answer', async () => {
    const res = await request(make()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(readinessResponseSchema.parse(res.body)).toEqual({
      status: 'ok',
      checks: { database: 'ok', redis: 'ok', storage: 'ok' },
    });
  });

  it('GET /health/ready returns 503 and names the failing dependency', async () => {
    const res = await request(make({ ...healthyChecks, redis: fail })).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'degraded',
      checks: { database: 'ok', redis: 'error', storage: 'ok' },
    });
  });
});

describe('error format', () => {
  it('unknown route -> 404 in the shared error shape', async () => {
    const res = await request(make()).get('/nope');
    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('malformed JSON -> 400 VALIDATION_ERROR', async () => {
    const res = await request(make())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  const errorApp = () => {
    const router = Router();
    router.get('/app-error', () => {
      throw new AppError('FORBIDDEN', 'nope');
    });
    router.get('/zod-error', () => {
      z.object({ a: z.string() }).parse({});
    });
    router.get('/boom', () => {
      throw new Error('secret internal detail');
    });
    return makeApp(db, { extraRoutes: router });
  };

  it('AppError keeps its code and status', async () => {
    const res = await request(errorApp()).get('/api/v1/app-error');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'nope' } });
  });

  it('ZodError -> 400 with field details', async () => {
    const res = await request(errorApp()).get('/api/v1/zod-error');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('a');
  });

  it('unknown error -> 500 without leaking the message', async () => {
    const res = await request(errorApp()).get('/api/v1/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});
