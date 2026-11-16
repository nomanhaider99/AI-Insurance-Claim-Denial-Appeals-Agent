# Architecture

```
Browser ──> web (Next.js, :3000) ──fetch, cookies──> api (Express, :4000)
                                                      │  ├─ Postgres + pgvector (Drizzle)
                                                      │  ├─ RustFS / R2 (S3 API) — documents
                                                      │  └─ Redis ──> BullMQ ──> worker (AI jobs)
```

- **apps/web** — UI only. Talks to the API through `src/lib/api-client.ts`; never touches the DB.
- **apps/api** — HTTP API (`src/server.ts`) and background worker (`src/worker.ts`) share one codebase and image.
  Layers: route → controller → service → repository (see `.claude/skills/api-endpoint`).
- **packages/shared** — Zod schemas and types used by both sides (error shape, enums, pagination).

## Invariants

1. **Tenancy:** every table except `organizations` has `org_id`; every query filters on it.
2. **Human in the loop:** AI output is a draft. Only a human transition sets `approved`.
3. **Auditability:** AI outputs store model, prompt version, inputs and cited sources (`ai_meta`, `citations`).
4. **Synthetic data only** in this repo, seeds and tests. Logs never contain PHI (pino redaction).

## Auth & tenancy (Phase 2)

- The browser only talks to the web origin; Next.js rewrites `/api/*` and `/health*` to the API (`API_INTERNAL_URL`). Cookies are first-party.
- Cookies: `access_token` (JWT, 15 min, path `/`), `refresh_token` (opaque, 30 days, path `/api/v1/auth`, stored hashed, rotated on every refresh, reuse revokes the family), `has_session` (hint for the route guard), `csrf_token` (readable; double-submit with `X-CSRF-Token`). All auth cookies are httpOnly + SameSite=Lax; `Secure` unless `COOKIE_SECURE=false`.
- `requireAuth` → `req.auth = { userId, orgId, role }` from the JWT only. `requireRole(...permissions.x)` uses the shared permission map in `packages/shared/src/auth.ts`.
- Repositories take `orgId` first. The only unscoped lookups are by email (login/register/forgot) and by secret token hash (refresh/reset/invite), which identify the row before a session exists.
- Audit: services write semantic rows (`auth.login`, `user.role_changed`, ...); `auditRequests` adds `http.<method>` rows for every authenticated mutation.
- Tests run against PGlite (in-process Postgres + pgvector) with the real migrations, so tenancy SQL is exercised without Docker.

## Health

- `GET /health` — liveness, no dependency calls.
- `GET /health/ready` — pings Postgres, Redis, object storage; 503 if any fails.

## Decisions

- pnpm workspaces without Turborepo — small repo, fewer moving parts.
- One API image runs `api`, `worker` and `migrate` (migrations + synthetic seed) with different commands.
- Local object storage is RustFS (S3-compatible); MinIO no longer publishes images. Production can use R2/S3 unchanged.
- Embeddings are `vector(1024)` with an HNSW cosine index; changing the model's dimension needs a migration + re-embed.
