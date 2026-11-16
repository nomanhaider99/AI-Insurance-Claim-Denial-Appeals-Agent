import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { logger } from '../logger.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

/** drizzle/ sits at the api package root; works from src/db (tsx) and dist/db (node). */
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

const pool = new pg.Pool({ connectionString: url });
await migrate(drizzle(pool), { migrationsFolder });
await pool.end();
logger.info('migrations applied');
