# Architecture

```
Browser ──> web (Next.js, :3000) ──fetch, cookies──> api (Express, :4000)
                                                      │  ├─ Postgres + pgvector (Drizzle)
                                                      │  ├─ MinIO / R2 (S3 API) — documents
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

## Health

- `GET /health` — liveness, no dependency calls.
- `GET /health/ready` — pings Postgres, Redis, object storage; 503 if any fails.

## Decisions

- pnpm workspaces without Turborepo — small repo, fewer moving parts.
- One API image runs `api`, `worker` and `migrate` with different commands.
- Embeddings are `vector(1024)` with an HNSW cosine index; changing the model's dimension needs a migration + re-embed.
