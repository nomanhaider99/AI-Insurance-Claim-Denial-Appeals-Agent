import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Schema = typeof schema;

/** Driver-agnostic DB handle: node-postgres in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

export function createDb(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db: Db = drizzle(pool, { schema });
  return { db, pool };
}
