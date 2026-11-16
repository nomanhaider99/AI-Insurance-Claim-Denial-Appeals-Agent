import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq, isNotNull } from 'drizzle-orm';
import { apiErrorSchema, meResponseSchema } from '@appeal/shared';
import type { Db } from '../src/db/client.js';
import { auditLogs, refreshTokens, users } from '../src/db/schema/index.js';
import {
  PASSWORD,
  captureMailer,
  createTestDb,
  loginAs,
  makeApp,
  makeOrg,
  makeUser,
  refreshCookieFrom,
  session,
} from './helpers.js';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const tokenFromLink = (link?: string) => new URL(link!).searchParams.get('token')!;

describe('register / login / me / logout', () => {
  it('register creates an org + admin, signs in, and never returns the password hash', async () => {
    const app = makeApp(db);
    const s = await session(app);
    const res = await s.post('/api/v1/auth/register', {
      orgName: 'Synthetic Family Practice',
      name: 'Ada Admin',
      email: 'Ada@Example.test',
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    const me = meResponseSchema.parse(res.body);
    expect(me.user).toMatchObject({ email: 'ada@example.test', role: 'admin' });
    expect(me.organization.name).toBe('Synthetic Family Practice');
    expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash/);

    const meRes = await s.get('/api/v1/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(me.user.id);
  });

  it('register rejects a duplicate email and a weak password', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const existing = await makeUser(db, org.id, 'biller');
    const s = await session(app);
    const dup = await s.post('/api/v1/auth/register', {
      orgName: 'X',
      name: 'X',
      email: existing.email,
      password: PASSWORD,
    });
    expect(dup.status).toBe(409);
    const weak = await s.post('/api/v1/auth/register', {
      orgName: 'X',
      name: 'X',
      email: 'weak@example.test',
      password: 'short',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details[0].path).toBe('password');
  });

  it('login with a wrong password or unknown email gives the same generic 401', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await session(app);
    const wrong = await s.post('/api/v1/auth/login', {
      email: user.email,
      password: 'nope-nope-nope',
    });
    const unknown = await s.post('/api/v1/auth/login', {
      email: 'nobody@example.test',
      password: 'nope-nope-nope',
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('sets httpOnly auth cookies, and me requires them', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'reviewer');
    const s = await session(app);
    const res = await s.post('/api/v1/auth/login', { email: user.email, password: PASSWORD });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const access = cookies.find((c) => c.startsWith('access_token='))!;
    const refresh = cookies.find((c) => c.startsWith('refresh_token='))!;
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Lax/);
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);

    const anon = await request(app).get('/api/v1/auth/me');
    expect(anon.status).toBe(401);
    expect(apiErrorSchema.parse(anon.body).error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a tampered access token', async () => {
    const app = makeApp(db);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad');
    expect(res.status).toBe(401);
  });

  it('logout revokes the refresh token and clears cookies', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await loginAs(app, user.email);
    const out = await s.post('/api/v1/auth/logout');
    expect(out.status).toBe(204);
    expect((await s.get('/api/v1/auth/me')).status).toBe(401);
    expect((await s.post('/api/v1/auth/refresh')).status).toBe(401);
  });

  it('records audit rows for login and failed login', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await session(app);
    await s.post('/api/v1/auth/login', { email: user.email, password: 'wrong-password-x' });
    await s.post('/api/v1/auth/login', { email: user.email, password: PASSWORD });
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.actorUserId, user.id));
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('auth.login_failed');
    expect(actions).toContain('auth.login');
    expect(rows.every((r) => r.orgId === org.id)).toBe(true);
  });
});

describe('refresh rotation', () => {
  it('rotates the refresh token; reusing the old one revokes the whole family', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await session(app);
    const login = await s.post('/api/v1/auth/login', { email: user.email, password: PASSWORD });
    const first = refreshCookieFrom(login)!;

    const r1 = await s.post('/api/v1/auth/refresh');
    expect(r1.status).toBe(200);
    const second = refreshCookieFrom(r1)!;
    expect(second).not.toBe(first);

    // Attacker replays the first (now revoked) token after the concurrency grace window.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(and(eq(refreshTokens.userId, user.id), isNotNull(refreshTokens.revokedAt)));
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${first}`, `csrf_token=${s.csrf}`])
      .set('X-CSRF-Token', s.csrf);
    expect(replay.status).toBe(401);

    // The legitimate session's newer token is now dead too.
    const r2 = await s.post('/api/v1/auth/refresh');
    expect(r2.status).toBe(401);
    const active = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, user.id)));
    expect(active.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('two tabs refreshing with the same cookie at once both succeed (no false theft alarm)', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await session(app);
    const login = await s.post('/api/v1/auth/login', { email: user.email, password: PASSWORD });
    const shared = refreshCookieFrom(login)!;
    const tab = () =>
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${shared}`, `csrf_token=${s.csrf}`])
        .set('X-CSRF-Token', s.csrf);
    const [a, b] = await Promise.all([tab(), tab()]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // Both tabs' new tokens keep working.
    for (const res of [a, b]) {
      const next = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshCookieFrom(res)}`, `csrf_token=${s.csrf}`])
        .set('X-CSRF-Token', s.csrf);
      expect(next.status).toBe(200);
    }
    const reuse = await db.select().from(auditLogs).where(eq(auditLogs.actorUserId, user.id));
    expect(reuse.map((r) => r.action)).not.toContain('auth.refresh_reuse');
  });

  it('a role change applies on the very next request, without waiting for refresh', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const admin = await makeUser(db, org.id, 'admin');
    await makeUser(db, org.id, 'admin'); // so the demotion below is allowed
    const s = await loginAs(app, admin.email);
    expect((await s.get('/api/v1/org/invites')).status).toBe(200);
    await db.update(users).set({ role: 'biller' }).where(eq(users.id, admin.id));
    // Same access token, but the DB role now wins.
    expect((await s.get('/api/v1/org/invites')).status).toBe(403);
    expect((await s.get('/api/v1/auth/me')).body.user.role).toBe('biller');
  });

  it('a deleted user is rejected even with a valid access token', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await loginAs(app, user.email);
    await db.delete(users).where(eq(users.id, user.id));
    expect((await s.get('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('CSRF', () => {
  it('rejects mutations without a matching token, and cross-site origins', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const body = { email: user.email, password: PASSWORD };

    const none = await request(app).post('/api/v1/auth/login').send(body);
    expect(none.status).toBe(403);

    const s = await session(app);
    const mismatch = await s.agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', 'wrong')
      .send(body);
    expect(mismatch.status).toBe(403);

    const evil = await s.agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', s.csrf)
      .set('Origin', 'https://evil.example')
      .send(body);
    expect(evil.status).toBe(403);

    const good = await s.agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', s.csrf)
      .set('Origin', 'http://localhost:3000')
      .send(body);
    expect(good.status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('locks out one email after 10 attempts, even when each request claims a new IP', async () => {
    const app = makeApp(db);
    const s = await session(app);
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await s.agent
        .post('/api/v1/auth/login')
        .set('X-CSRF-Token', s.csrf)
        .set('X-Forwarded-For', `203.0.113.${i}`) // spoofed; TRUST_PROXY=0 ignores it
        .send({ email: 'target@example.test', password: 'wrong-password-x' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((st) => st === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(
      apiErrorSchema.parse(
        (
          await s.post('/api/v1/auth/login', {
            email: 'target@example.test',
            password: 'x',
          })
        ).body,
      ).error.code,
    ).toBe('RATE_LIMITED');
  });

  it('limits one source spraying many emails (per-IP limit)', async () => {
    const app = makeApp(db);
    const s = await session(app);
    let last = 0;
    for (let i = 0; i < 21; i++) {
      const res = await s.post('/api/v1/auth/login', {
        email: `spray-${i}@example.test`,
        password: 'wrong-password-x',
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe('password reset', () => {
  it('forgot always returns 200; the emailed token resets once and revokes sessions', async () => {
    const mailer = captureMailer();
    const app = makeApp(db, { mailer });
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const old = await loginAs(app, user.email);

    const s = await session(app);
    expect(
      (await s.post('/api/v1/auth/password/forgot', { email: 'ghost@example.test' })).status,
    ).toBe(200);
    expect(mailer.sent).toHaveLength(0);
    expect((await s.post('/api/v1/auth/password/forgot', { email: user.email })).status).toBe(200);
    expect(mailer.sent).toHaveLength(1);
    const token = tokenFromLink(mailer.sent[0]!.link);

    const newPassword = 'brand-new-Password-456';
    expect(
      (await s.post('/api/v1/auth/password/reset', { token, password: newPassword })).status,
    ).toBe(200);
    // Single use.
    const again = await s.post('/api/v1/auth/password/reset', { token, password: newPassword });
    expect(again.status).toBe(400);
    // Old sessions are dead immediately: access token and refresh token.
    expect((await old.get('/api/v1/auth/me')).status).toBe(401);
    expect((await old.post('/api/v1/auth/refresh')).status).toBe(401);
    // Old password fails; new one works.
    await expect(loginAs(app, user.email)).rejects.toThrow();
    await expect(loginAs(app, user.email, newPassword)).resolves.toBeTruthy();
  });

  it('requesting a new reset link invalidates the previous one', async () => {
    const mailer = captureMailer();
    const app = makeApp(db, { mailer });
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await session(app);
    await s.post('/api/v1/auth/password/forgot', { email: user.email });
    await s.post('/api/v1/auth/password/forgot', { email: user.email });
    const [first, second] = mailer.sent.map((m) => tokenFromLink(m.link));
    const password = 'brand-new-Password-456';
    expect((await s.post('/api/v1/auth/password/reset', { token: first, password })).status).toBe(
      400,
    );
    expect((await s.post('/api/v1/auth/password/reset', { token: second, password })).status).toBe(
      200,
    );
  });

  it('rejects an expired reset token', async () => {
    const mailer = captureMailer();
    const app = makeApp(db, { mailer });
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await session(app);
    await s.post('/api/v1/auth/password/forgot', { email: user.email });
    const token = tokenFromLink(mailer.sent[0]!.link);
    const { passwordResetTokens } = await import('../src/db/schema/index.js');
    await db
      .update(passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(passwordResetTokens.userId, user.id));
    const res = await s.post('/api/v1/auth/password/reset', {
      token,
      password: 'brand-new-Password-456',
    });
    expect(res.status).toBe(400);
  });
});

describe('invites', () => {
  it("inviting an address that exists in another org doesn't reveal it; acceptance then fails cleanly", async () => {
    const mailer = captureMailer();
    const app = makeApp(db, { mailer });
    const orgA = await makeOrg(db);
    const orgB = await makeOrg(db);
    const adminA = await makeUser(db, orgA.id, 'admin');
    const memberB = await makeUser(db, orgB.id, 'biller');
    const a = await loginAs(app, adminA.email);
    const inv = await a.post('/api/v1/org/invites', { email: memberB.email, role: 'biller' });
    expect(inv.status).toBe(201);
    const acc = await (
      await session(app)
    ).post('/api/v1/auth/invites/accept', {
      token: tokenFromLink(mailer.sent.at(-1)!.link),
      name: 'X',
      password: PASSWORD,
    });
    expect(acc.status).toBe(409);
    // A same-org member is reported, since the admin can already see them.
    const self = await a.post('/api/v1/org/invites', { email: adminA.email, role: 'biller' });
    expect(self.status).toBe(409);
  });

  it('accepting an invite creates the user in the inviting org with the invited role', async () => {
    const mailer = captureMailer();
    const app = makeApp(db, { mailer });
    const org = await makeOrg(db);
    const admin = await makeUser(db, org.id, 'admin');
    const a = await loginAs(app, admin.email);
    const inv = await a.post('/api/v1/org/invites', {
      email: 'new.reviewer@example.test',
      role: 'reviewer',
    });
    expect(inv.status).toBe(201);
    expect(JSON.stringify(inv.body)).not.toContain('token');

    const token = tokenFromLink(mailer.sent.at(-1)!.link);
    const s = await session(app);
    const acc = await s.post('/api/v1/auth/invites/accept', {
      token,
      name: 'New Reviewer',
      password: PASSWORD,
    });
    expect(acc.status).toBe(201);
    expect(acc.body.user).toMatchObject({ orgId: org.id, role: 'reviewer' });
    // Single use.
    const again = await (
      await session(app)
    ).post('/api/v1/auth/invites/accept', {
      token,
      name: 'Someone',
      password: PASSWORD,
    });
    expect(again.status).toBe(400);
  });
});
