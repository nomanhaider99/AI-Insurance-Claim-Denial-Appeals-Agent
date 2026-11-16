/**
 * Seeds SYNTHETIC data only. Never put real patient, payer-member or staff data here.
 * Idempotent: safe to run repeatedly.
 */
import { createDb } from './client.js';
import { organizations } from './schema/index.js';
import { logger } from '../logger.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const { db, pool } = createDb(url);

await db
  .insert(organizations)
  .values({ name: 'Demo Clinic (synthetic)', slug: 'demo-clinic' })
  .onConflictDoNothing({ target: organizations.slug });

// Users are seeded in Phase 2 once argon2 hashing exists (see .claude/skills/auth-rbac).

await pool.end();
logger.info('seed complete');
