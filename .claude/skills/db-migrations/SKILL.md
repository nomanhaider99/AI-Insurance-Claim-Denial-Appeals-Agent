---
name: db-migrations
description: Database schema changes with Drizzle in apps/api — editing src/db/schema, generating migrations, custom SQL migrations, and seed scripts with synthetic data. Use for any table, column, index, enum or seed change.
---

# DB migrations (Drizzle)

## Workflow

1. Edit the schema in `apps/api/src/db/schema/index.ts` (split into files when it grows; re-export from `index.ts`).
2. Generate: `pnpm db:generate` (runs `drizzle-kit generate`). Give it a meaningful name: `pnpm --filter @appeal/api exec drizzle-kit generate --name=add_claim_notes`.
3. Read the generated SQL in `apps/api/drizzle/` before committing. Check for unwanted drops or renames.
4. Apply: `pnpm migrate` locally (Docker runs the `migrate` service on `docker compose up`).
5. Commit the schema change, the SQL file and `drizzle/meta/*` together.

## Rules

- **Drizzle migrations only.** No manual DDL against any database and no `drizzle-kit push` outside throwaway local DBs.
- **Never edit or delete a migration that has been applied or committed.** To fix one, add a new migration.
- Extensions, triggers and data backfills go in **custom migrations** (`drizzle-kit generate --custom --name=...`). `0000_enable_pgvector.sql` is the example.
- **Safe changes:** add a column as nullable or with a default, backfill, then make it NOT NULL in a later migration. Create indexes on large tables `CONCURRENTLY` in a custom migration.
- **Enums** come from `@appeal/shared` arrays so the DB and Zod stay in sync. Adding a value is a migration; removing one needs a data migration first.
- **Tenancy:** new tables follow `multi-tenancy` (`org_id` + index).
- **Timestamps:** `timestamptz` via the `createdAt()`/`updatedAt()` helpers. **Ids:** `uuid` with `defaultRandom()`.
- **Money:** `numeric(12,2)`, never float. **Codes** (CPT, ICD-10, CARC, RARC) are `text[]`.
- **Vectors:** dimension is `EMBEDDING_DIMENSIONS`. Changing it needs a new migration plus a re-embed job.

## Seeds

- `apps/api/src/db/seed.ts`, run with `pnpm db:seed`. It must be **idempotent** (`onConflictDoNothing` on natural keys).
- **Synthetic data only.** Use obviously fake names ("Demo Clinic (synthetic)", patient refs like `SYN-0001`), fake member ids and made-up claim numbers. Never copy real letters, names, DOBs or member ids.
- Synthetic denial letters and fixtures go under `apps/api/seed-data/` and are marked as synthetic in the file.

## Checklist

- [ ] Schema edited, migration generated (not hand-written DDL) and reviewed
- [ ] No applied migration was modified
- [ ] Columns are added in a backwards-compatible way; risky steps are split across migrations
- [ ] New tables have `org_id` and indexes
- [ ] `pnpm migrate` runs cleanly on a fresh DB (`docker compose down -v && docker compose up`)
- [ ] Seed is idempotent and synthetic
