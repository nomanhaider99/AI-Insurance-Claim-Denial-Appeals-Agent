# AppealAI — Claude Code guide

AppealAI helps clinic billing staff appeal insurance claim denials. Staff upload a denial letter or EOB plus records. The system extracts the claim and denial codes, classifies the denial and scores it, retrieves payer policy clauses (RAG), and drafts a cited appeal letter. A human reviews, edits, approves and exports it, and the app tracks deadlines and outcomes.

**Read `PLAN.md` before starting a phase.** Work one phase at a time. Stop at the end of each phase and wait for approval.

## Non-negotiable rules

- **Human in the loop.** The AI drafts; a person approves. Never auto-submit anything.
- **Synthetic / de-identified data only.** Never use real patient data: not in seeds, tests, fixtures or prompts.
- **No payer-portal scraping and no stored payer credentials.** Intake is file upload plus CSV/Sheets import.
- **Auditable AI.** Every AI output stores its inputs, model, prompt version and cited sources.

## Stack

Next.js (App Router) + TS + Tailwind + shadcn/ui + TanStack Query · Express + TS + Zod · Postgres + pgvector via Drizzle · BullMQ + Redis · MinIO/R2 (S3 API) · Anthropic Claude API · argon2 + JWT in httpOnly cookies + RBAC · Vitest, Supertest, Playwright · Docker Compose, k3s, GitHub Actions.

```
apps/web         Next.js frontend (src/app, src/components, src/lib/api-client.ts)
apps/api         Express API (src/server.ts) + BullMQ worker (src/worker.ts); Drizzle schema in src/db/schema, migrations in drizzle/
packages/shared  Zod schemas + shared types (error shape, enums, pagination)
infra            Dockerfiles (k8s manifests in Phase 6)
docs             architecture.md, decisions
```

## Commands (from repo root)

| Task                     | Command                                                     |
| ------------------------ | ----------------------------------------------------------- |
| Dev (web + api)          | `pnpm dev` (worker: `pnpm --filter @appeal/api dev:worker`) |
| Full stack in Docker     | `docker compose up --build`                                 |
| Test                     | `pnpm test`                                                 |
| Lint (ESLint + Prettier) | `pnpm lint` (fix formatting: `pnpm format`)                 |
| Typecheck                | `pnpm typecheck`                                            |
| Migrate                  | `pnpm migrate` (new migration: `pnpm db:generate`)          |
| Seed synthetic data      | `pnpm db:seed`                                              |

Run `pnpm lint && pnpm typecheck && pnpm test` before calling any task done.

## Conventions: follow the skill for the task

Skills live in `.claude/skills/`: `api-endpoint`, `multi-tenancy`, `auth-rbac`, `db-migrations`, `agent-pipeline`, `rag-retrieval`, `phi-security`, `frontend-ui`, `testing`, `k8s-deploy`. Every API error uses the shape `{ error: { code, message, details? } }` from `@appeal/shared`. Every query is scoped by `org_id`. Update `docs/` and this file when conventions change.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
