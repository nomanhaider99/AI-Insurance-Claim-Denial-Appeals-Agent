import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import type { Db } from '../src/db/client.js';
import { invites, users } from '../src/db/schema/index.js';
import { signAccessToken } from '../src/lib/tokens.js';
import {
  createTestDb,
  loginAs,
  makeApp,
  makeOrg,
  makeUser,
  testConfig,
  type Session,
} from './helpers.js';

/**
 * Phase 2 "done when": a user from org A can never read or change org B's data.
 * Every org-scoped route is exercised from org B against org A's ids.
 */
let db: Db;
let app: Express;
let orgA: { id: string };
let orgB: { id: string };
let userA: { id: string; email: string };
let adminB: Session;
let inviteA: string;
let adminBId: string;

beforeAll(async () => {
  db = await createTestDb();
  app = makeApp(db);
  orgA = await makeOrg(db, 'Org A (synthetic)');
  orgB = await makeOrg(db, 'Org B (synthetic)');
  const adminA = await makeUser(db, orgA.id, 'admin');
  userA = await makeUser(db, orgA.id, 'biller');
  const adminBUser = await makeUser(db, orgB.id, 'admin');
  adminBId = adminBUser.id;
  await makeUser(db, orgB.id, 'reviewer');

  const a = await loginAs(app, adminA.email);
  const inv = await a.post('/api/v1/org/invites', {
    email: 'a-invitee@example.test',
    role: 'biller',
  });
  inviteA = inv.body.id;
  adminB = await loginAs(app, adminBUser.email);
});

describe('cross-tenant isolation', () => {
  it("GET another org's user -> 404 (existence not revealed)", async () => {
    const res = await adminB.get(`/api/v1/org/users/${userA.id}`);
    expect(res.status).toBe(404);
  });

  it("PATCH another org's user role -> 404 and no change", async () => {
    const res = await adminB.patch(`/api/v1/org/users/${userA.id}/role`, { role: 'admin' });
    expect(res.status).toBe(404);
    const [row] = await db.select().from(users).where(eq(users.id, userA.id));
    expect(row?.role).toBe('biller');
  });

  it("DELETE another org's invite -> 404 and the invite survives", async () => {
    const res = await adminB.delete(`/api/v1/org/invites/${inviteA}`);
    expect(res.status).toBe(404);
    const [row] = await db.select().from(invites).where(eq(invites.id, inviteA));
    expect(row).toBeDefined();
  });

  it("lists never include another org's rows", async () => {
    const usersRes = await adminB.get('/api/v1/org/users?pageSize=100');
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.data.every((u: { orgId: string }) => u.orgId === orgB.id)).toBe(true);
    expect(usersRes.body.total).toBe(2);

    const invRes = await adminB.get('/api/v1/org/invites');
    expect(invRes.body.data.map((i: { id: string }) => i.id)).not.toContain(inviteA);

    const org = await adminB.get('/api/v1/org');
    expect(org.body.id).toBe(orgB.id);
  });

  it('a forged orgId in body or query is ignored', async () => {
    const list = await adminB.get(`/api/v1/org/users?orgId=${orgA.id}&org_id=${orgA.id}`);
    expect(list.body.data.every((u: { orgId: string }) => u.orgId === orgB.id)).toBe(true);

    const inv = await adminB.post('/api/v1/org/invites', {
      email: 'forged@example.test',
      role: 'biller',
      orgId: orgA.id,
    });
    expect(inv.status).toBe(201);
    const [row] = await db.select().from(invites).where(eq(invites.id, inv.body.id));
    expect(row?.orgId).toBe(orgB.id);
  });

  it("a valid token for org B can't be pointed at org A by tampering with claims", async () => {
    // Token signed with the wrong secret (attacker-made) is rejected outright.
    const forged = await signAccessToken(
      { userId: userA.id, orgId: orgA.id, role: 'admin', sessionVersion: 0 },
      'attacker-secret-attacker-secret-1234',
    );
    const res = await request(app).get('/api/v1/org/users').set('Cookie', `access_token=${forged}`);
    expect(res.status).toBe(401);
  });

  it("a genuine token is still scoped: org B's admin id with org A's id in the URL -> 404", async () => {
    const token = await signAccessToken(
      {
        userId: adminBId,
        orgId: orgB.id,
        role: 'admin',
        sessionVersion: 0,
      },
      testConfig.jwtAccessSecret,
    );
    const res = await request(app)
      .get(`/api/v1/org/users/${userA.id}`)
      .set('Cookie', `access_token=${token}`);
    expect(res.status).toBe(404);
  });
});
