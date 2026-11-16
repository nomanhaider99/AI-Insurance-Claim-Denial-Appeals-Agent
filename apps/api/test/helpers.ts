import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import request from 'supertest';
import type { Express, Router } from 'express';
import type { Role } from '@appeal/shared';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import type { Db } from '../src/db/client.js';
import * as schema from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/password.js';
import type { Mail, Mailer } from '../src/lib/mailer.js';
import type { HealthChecks } from '../src/routes/health.js';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

/** In-process Postgres (PGlite + pgvector) with the real migrations applied. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Db;
}

export const testConfig: AppConfig = {
  webOrigin: 'http://localhost:3000',
  appUrl: 'http://localhost:3000',
  jwtAccessSecret: 'test-only-jwt-secret-0123456789-abcdef',
  cookieSecure: false,
  trustProxy: 0,
};

export function captureMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
    },
  };
}

const ok = async () => {};
export const healthyChecks: HealthChecks = { database: ok, redis: ok, storage: ok };

export function makeApp(
  db: Db,
  opts: { mailer?: Mailer; extraRoutes?: Router; healthChecks?: HealthChecks } = {},
): Express {
  return createApp({
    db,
    config: testConfig,
    mailer: opts.mailer ?? captureMailer(),
    healthChecks: opts.healthChecks ?? healthyChecks,
    extraRoutes: opts.extraRoutes,
  });
}

// ---- synthetic fixtures ---------------------------------------------------

export const PASSWORD = 'synthetic-Password-123';
let seq = 0;
const next = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function makeOrg(db: Db, name = 'Synthetic Clinic') {
  const [org] = await db
    .insert(schema.organizations)
    .values({ name, slug: `syn-${next()}` })
    .returning();
  return org!;
}

let cachedHash: Promise<string> | undefined;
export async function makeUser(db: Db, orgId: string, role: Role, email?: string) {
  cachedHash ??= hashPassword(PASSWORD);
  const [user] = await db
    .insert(schema.users)
    .values({
      orgId,
      role,
      email: email ?? `${role}-${next()}@example.test`,
      name: `Synthetic ${role}`,
      passwordHash: await cachedHash,
    })
    .returning();
  return user!;
}

/** A cookie-keeping client that sends the CSRF header on every mutation. */
export async function session(app: Express) {
  const agent = request.agent(app);
  const res = await agent.get('/api/v1/auth/csrf');
  const csrf: string = res.body.csrfToken;
  return {
    agent,
    csrf,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => agent.post(url).set('X-CSRF-Token', csrf).send(body),
    patch: (url: string, body?: object) => agent.patch(url).set('X-CSRF-Token', csrf).send(body),
    delete: (url: string) => agent.delete(url).set('X-CSRF-Token', csrf),
  };
}
export type Session = Awaited<ReturnType<typeof session>>;

export async function loginAs(app: Express, email: string, password = PASSWORD): Promise<Session> {
  const s = await session(app);
  const res = await s.post('/api/v1/auth/login', { email, password });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return s;
}

/** Reads the raw refresh token cookie value from a response. */
export function refreshCookieFrom(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const c = raw?.find((v) => v.startsWith('refresh_token='));
  return c?.split(';')[0]?.slice('refresh_token='.length) || undefined;
}
