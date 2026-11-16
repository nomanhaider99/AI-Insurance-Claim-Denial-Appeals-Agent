import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client.js';
import { logger } from '../logger.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

// Works from src/db (tsx) and dist/db (node): drizzle/ sits at the api package root.
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

const { db, pool } = createDb(url);
await migrate(db, { migrationsFolder });
await pool.end();
logger.info('migrations applied');
