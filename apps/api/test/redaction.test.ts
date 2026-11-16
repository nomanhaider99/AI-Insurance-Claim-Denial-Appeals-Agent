import { Writable } from 'node:stream';
import { beforeAll, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { redactPaths } from '../src/logger.js';
import type { Db } from '../src/db/client.js';
import { auditLogs } from '../src/db/schema/index.js';
import { createTestDb, loginAs, makeApp, makeOrg, makeUser } from './helpers.js';

describe('log redaction', () => {
  it('censors passwords, tokens and PHI-like fields', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk));
        cb();
      },
    });
    const log = pino({ redact: { paths: redactPaths, censor: '[REDACTED]' } }, sink);
    log.info({
      body: {
        password: 'hunter2-synthetic',
        refreshToken: 'rt-synthetic',
        patientName: 'Jane Synthetic',
      },
      req: { headers: { authorization: 'Bearer abc', cookie: 'access_token=xyz' } },
    });
    const out = lines.join('');
    for (const secret of [
      'hunter2-synthetic',
      'rt-synthetic',
      'Jane Synthetic',
      'Bearer abc',
      'xyz',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[REDACTED]');
  });
});

describe('audit trail', () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('records a semantic row for role changes and an http row for the request', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const admin = await makeUser(db, org.id, 'admin');
    const target = await makeUser(db, org.id, 'biller');
    const s = await loginAs(app, admin.email);
    const res = await s.patch(`/api/v1/org/users/${target.id}/role`, { role: 'reviewer' });
    expect(res.status).toBe(200);

    const [semantic] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'user.role_changed'), eq(auditLogs.entityId, target.id)));
    expect(semantic).toMatchObject({ orgId: org.id, actorUserId: admin.id });
    expect(semantic?.metadata).toEqual({ from: 'biller', to: 'reviewer' });

    // The request-level row is written after the response finishes.
    let http;
    for (let i = 0; i < 20 && !http; i++) {
      [http] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.action, 'http.patch'), eq(auditLogs.actorUserId, admin.id)));
      if (!http) await new Promise((r) => setTimeout(r, 25));
    }
    expect(http?.metadata).toEqual({ route: '/api/v1/org/users/:id/role', status: 200 });
  });
});
