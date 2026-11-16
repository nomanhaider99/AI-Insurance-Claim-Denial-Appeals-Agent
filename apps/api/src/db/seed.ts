/**
 * Seeds SYNTHETIC data only. Never put real patient, payer-member or staff data here.
 * Idempotent: safe to run repeatedly.
 *
 * Demo logins (all orgs): admin@<slug>.example.test, reviewer@..., biller@...
 * Password: SEED_PASSWORD env, default "Demo-Password-123!" (dev only).
 */
import { eq } from 'drizzle-orm';
import type { Role } from '@appeal/shared';
import { createDb } from './client.js';
import { organizations, users } from './schema/index.js';
import { hashPassword } from '../lib/password.js';
import { logger } from '../logger.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const password = process.env.SEED_PASSWORD ?? 'Demo-Password-123!';

const orgs = [
  { name: 'Demo Clinic (synthetic)', slug: 'demo-clinic' },
  { name: 'Sample Health (synthetic)', slug: 'sample-health' },
];
const roles: Role[] = ['admin', 'reviewer', 'biller'];

const { db, pool } = createDb(url);
const passwordHash = await hashPassword(password);

for (const o of orgs) {
  await db.insert(organizations).values(o).onConflictDoNothing({ target: organizations.slug });
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, o.slug));
  if (!org) throw new Error(`org ${o.slug} missing after insert`);
  for (const role of roles) {
    await db
      .insert(users)
      .values({
        orgId: org.id,
        email: `${role}@${o.slug}.example.test`,
        name: `Demo ${role[0]!.toUpperCase()}${role.slice(1)}`,
        role,
        passwordHash,
      })
      .onConflictDoNothing({ target: users.email });
  }
}

await pool.end();
logger.info({ orgs: orgs.map((o) => o.slug) }, 'seed complete');
