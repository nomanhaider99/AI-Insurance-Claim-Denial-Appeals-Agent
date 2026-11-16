import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import type { Role } from '@appeal/shared';
import type { Db } from '../src/db/client.js';
import { createTestDb, loginAs, makeApp, makeOrg, makeUser, type Session } from './helpers.js';

/**
 * Role matrix: each route × each role. "allowed" means not 401/403;
 * the exact success code is covered elsewhere.
 */
type Case = {
  name: string;
  allowed: Role[];
  call: (
    s: Session,
    ids: { targetUserId: string; inviteId: string },
  ) => Promise<{ status: number }>;
};

const cases: Case[] = [
  { name: 'GET /org', allowed: ['admin', 'reviewer', 'biller'], call: (s) => s.get('/api/v1/org') },
  {
    name: 'GET /org/users',
    allowed: ['admin', 'reviewer'],
    call: (s) => s.get('/api/v1/org/users'),
  },
  {
    name: 'GET /org/users/:id',
    allowed: ['admin', 'reviewer'],
    call: (s, ids) => s.get(`/api/v1/org/users/${ids.targetUserId}`),
  },
  {
    name: 'PATCH /org/users/:id/role',
    allowed: ['admin'],
    call: (s, ids) => s.patch(`/api/v1/org/users/${ids.targetUserId}/role`, { role: 'biller' }),
  },
  { name: 'GET /org/invites', allowed: ['admin'], call: (s) => s.get('/api/v1/org/invites') },
  {
    name: 'POST /org/invites',
    allowed: ['admin'],
    call: (s) =>
      s.post('/api/v1/org/invites', {
        email: `inv-${Math.random().toString(36).slice(2)}@example.test`,
        role: 'biller',
      }),
  },
  {
    name: 'DELETE /org/invites/:id',
    allowed: ['admin'],
    call: (s, ids) => s.delete(`/api/v1/org/invites/${ids.inviteId}`),
  },
];

const roles: Role[] = ['admin', 'reviewer', 'biller'];

let db: Db;
let app: Express;
let sessions: Record<Role, Session>;
let orgId: string;

beforeAll(async () => {
  db = await createTestDb();
  app = makeApp(db);
  const org = await makeOrg(db);
  orgId = org.id;
  const entries = await Promise.all(
    roles.map(async (role) => {
      const u = await makeUser(db, org.id, role);
      return [role, await loginAs(app, u.email)] as const;
    }),
  );
  sessions = Object.fromEntries(entries) as Record<Role, Session>;
});

async function freshIds() {
  const target = await makeUser(db, orgId, 'biller');
  const inv = await sessions.admin.post('/api/v1/org/invites', {
    email: `pending-${Math.random().toString(36).slice(2)}@example.test`,
    role: 'biller',
  });
  return { targetUserId: target.id, inviteId: inv.body.id as string };
}

describe('role matrix', () => {
  for (const c of cases) {
    for (const role of roles) {
      const allowed = c.allowed.includes(role);
      it(`${role} ${allowed ? 'can' : 'cannot'} ${c.name}`, async () => {
        const res = await c.call(sessions[role], await freshIds());
        if (allowed) {
          expect([401, 403]).not.toContain(res.status);
          expect(res.status).toBeLessThan(400);
        } else {
          expect(res.status).toBe(403);
        }
      });
    }
  }

  it('unauthenticated requests get 401, not 403', async () => {
    const { default: request } = await import('supertest');
    expect((await request(app).get('/api/v1/org/users')).status).toBe(401);
  });
});

describe('role changes', () => {
  it('an admin cannot demote the last admin of the org', async () => {
    const solo = await makeOrg(db, 'Solo Clinic');
    const admin = await makeUser(db, solo.id, 'admin');
    const s = await loginAs(app, admin.email);
    const res = await s.patch(`/api/v1/org/users/${admin.id}/role`, { role: 'biller' });
    expect(res.status).toBe(409);
  });

  it('rejects an unknown role value', async () => {
    const { targetUserId } = await freshIds();
    const res = await sessions.admin.patch(`/api/v1/org/users/${targetUserId}/role`, {
      role: 'superuser',
    });
    expect(res.status).toBe(400);
  });
});
