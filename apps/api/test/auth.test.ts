import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
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

    // Attacker replays the first (now revoked) token.
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

  it('refresh picks up a role change made since login', async () => {
    const app = makeApp(db);
    const org = await makeOrg(db);
    const user = await makeUser(db, org.id, 'biller');
    const s = await loginAs(app, user.email);
    await db.update(users).set({ role: 'reviewer' }).where(eq(users.id, user.id));
    await s.post('/api/v1/auth/refresh');
    expect((await s.get('/api/v1/org/users')).status).toBe(200); // reviewer may view users
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
  it('locks out repeated login attempts for one email with 429', async () => {
    const app = makeApp(db);
    const s = await session(app);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await s.post('/api/v1/auth/login', {
        email: 'target@example.test',
        password: 'wrong-password-x',
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((st) => st === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
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
    // Old sessions can no longer refresh; old password fails; new one works.
    expect((await old.post('/api/v1/auth/refresh')).status).toBe(401);
    await expect(loginAs(app, user.email)).rejects.toThrow();
    await expect(loginAs(app, user.email, newPassword)).resolves.toBeTruthy();
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
