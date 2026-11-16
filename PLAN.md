# AppealAI — AI Insurance Claim Denial Appeals Agent

> Handoff document for Claude Code. Read this fully before writing any code.
> Work **one phase at a time**. Do not start a phase until the previous phase's "Done when" checks pass.

## 1. Product

Billing staff at clinics upload an insurance **denial letter / EOB** plus supporting records. The system:

1. Extracts the claim data and denial reason (CARC/RARC codes, CPT/ICD-10, dates, amounts).
2. Classifies the denial and scores whether it is worth appealing.
3. Retrieves relevant **payer policy clauses** (RAG) and evidence from the records.
4. Drafts an **appeal letter** with cited clauses.
5. A human reviews, edits, approves, and exports it. The app tracks deadlines and outcomes.

**Rules**

- Human-in-the-loop always. The AI drafts; a person approves. Never auto-submit.
- **Synthetic / de-identified data only.** Never use real patient data.
- No payer-portal scraping or credential storage. Intake is upload + CSV/Sheets import.
- Every AI output stores its inputs, model, prompt version, and cited sources (auditable).

## 2. Stack

| Layer        | Choice                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Frontend     | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query                            |
| Backend      | Express + TypeScript + Zod validation                                                                |
| Database     | Self-hosted PostgreSQL + pgvector (no managed transfer limits)                                       |
| ORM          | Drizzle                                                                                              |
| Queue        | BullMQ + Redis                                                                                       |
| File storage | S3-compatible: MinIO (self-hosted) or Cloudflare R2 (no egress fees)                                 |
| AI           | Anthropic Claude API (PDF/vision input + tool use + structured JSON output); embedding model for RAG |
| Auth         | Email/password with argon2, JWT access + refresh in httpOnly cookies, RBAC                           |
| Testing      | Vitest, Supertest, Playwright                                                                        |
| Infra        | Docker, Docker Compose (dev), Kubernetes (k3s on a VPS), GitHub Actions                              |
| Tooling      | Claude Code, Ponytail (token saving), Graphify (set up per each tool's own docs)                     |

Monorepo layout:

```
/apps/web        Next.js frontend
/apps/api        Express API + workers
/packages/shared Zod schemas + shared types
/infra           Dockerfiles, docker-compose, k8s manifests
/docs            architecture, decisions
/.claude         skills, agents, commands
```

## 3. Claude Code skills to create (Phase 0)

Create each as `.claude/skills/<name>/SKILL.md` (frontmatter `name` + `description`, then concise instructions with code conventions and a checklist). Claude Code should write these itself from the specs below, then follow them in later phases.

| Skill            | What it must enforce                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth-rbac`      | argon2 hashing, refresh-token rotation, httpOnly cookies, CSRF protection, roles (admin, reviewer, biller), `requireRole` middleware, rate limiting on auth routes |
| `multi-tenancy`  | Every table has `org_id`; every query is scoped by `org_id`; tests proving cross-tenant access is impossible                                                       |
| `api-endpoint`   | Route → controller → service → repository layers, Zod validation, consistent error format, pagination, OpenAPI comments                                            |
| `db-migrations`  | Drizzle migrations only, never edit applied migrations, seed scripts with synthetic data                                                                           |
| `agent-pipeline` | Queue job pattern, retries, idempotency, structured outputs validated by Zod, store prompt version and token usage, no secrets in logs                             |
| `rag-retrieval`  | Chunking rules, embedding + pgvector query, citation format (doc, section, page), "no source, no claim" rule                                                       |
| `phi-security`   | PHI redaction in logs, encryption at rest for files, signed URLs, audit log for every read/write of claim data                                                     |
| `frontend-ui`    | Page/component conventions, forms with Zod, loading/error states, accessibility basics                                                                             |
| `testing`        | Unit + API + e2e conventions, what must be tested per feature                                                                                                      |
| `k8s-deploy`     | Dockerfile standards, health probes, resource limits, HPA, secrets handling, rollout checklist                                                                     |

Also create `CLAUDE.md` in the repo root (short): project summary, the rules in section 1, the stack, commands (`dev`, `test`, `lint`, `migrate`), and "read PLAN.md before starting a phase."

Optional subagents in `.claude/agents/`: `reviewer` (security + code review after each phase), `test-writer`.

---

## Phase 1 — Foundation

**Goal:** a running skeleton with everything wired.

- Monorepo, TypeScript configs, ESLint/Prettier, shared package
- `docker-compose.yml`: web, api, worker, postgres (pgvector), redis, minio
- Express app with health check, error handler, logger (pino), env validation
- Next.js app with layout, dashboard shell, API client
- Drizzle setup + initial schema: `organizations`, `users`, `claims`, `denials`, `documents`, `appeals`, `policy_docs`, `policy_chunks`, `audit_logs`
- GitHub Actions: lint, typecheck, test, build
- Create all skills and `CLAUDE.md` (section 3)

**Done when:** `docker compose up` starts everything, health check works, CI is green.

## Phase 2 — Auth, multi-tenancy, RBAC

**Goal:** secure users and organizations.

- Register/login/logout/refresh, password reset flow (email can be a console stub)
- Organization creation, invite users, roles
- `requireAuth` and `requireRole` middleware; every query scoped by `org_id`
- Audit log middleware
- Frontend: login, register, protected routes, role-aware navigation
- Tests: auth flow, role enforcement, cross-tenant isolation

**Done when:** a user from org A can never read org B's data (tested), and roles restrict actions correctly.

## Phase 3 — Denial intake & extraction

**Goal:** upload a denial and get structured data.

- Upload (PDF/image) to object storage with signed URLs; file type and size validation
- Worker job: send the document to Claude, extract structured JSON (payer, claim no., dates, CPT/ICD-10, billed amount, denial codes, denial reason text) validated by Zod
- Claims list/detail UI with extracted fields editable by the user, confidence flags for uncertain fields
- CSV import (Google Sheets export) for bulk claims
- Denial classifier: category (coding, medical necessity, prior auth, eligibility, duplicate, timely filing) + appealable score + deadline
- Seed script with **synthetic** denial letters

**Done when:** uploading a synthetic denial produces correct, editable structured data and a category.

## Phase 4 — Policy RAG & appeal drafting

**Goal:** generate cited appeal letters.

- Policy library: upload/ingest public payer policy documents, chunk, embed, store in pgvector
- Retrieval service: query by denial reason + codes, return top chunks with citations
- Evidence step: extract supporting facts from uploaded clinical notes/records
- Appeal agent: draft letter from template + denial data + retrieved clauses + evidence; every claim must cite a source; if no source, flag it instead of inventing
- Versioned drafts; PDF/DOCX export
- Evaluation script: small set of synthetic cases scoring citation accuracy and completeness

**Done when:** a synthetic denial yields a letter whose citations all trace to real chunks, and export works.

## Phase 5 — Review workflow, tracking & analytics

**Goal:** make it a usable product.

- Review screen: denial, evidence, and draft side by side; edit, approve, reject with comment
- Status pipeline: denied → drafted → in review → approved → submitted → won/lost
- Deadline alerts and reminders (queue-based, in-app + email stub)
- Dashboard: denial rate by payer/reason, recovered revenue, appeal success rate, aging
- Feedback loop: record outcome and reviewer edits for later prompt/template improvement
- Notifications and activity feed

**Done when:** a full case goes from upload to approved appeal to recorded outcome, and the dashboard reflects it.

## Phase 6 — Hardening, deployment & demo

**Goal:** production-ready and demonstrable.

- Security pass: rate limits, headers (helmet), input validation review, dependency audit, secrets via env/K8s secrets, PHI-safe logs
- Performance: indexes, pagination, caching where needed, queue concurrency settings
- Production Dockerfiles (multi-stage, non-root), health/readiness probes
- Kubernetes manifests: deployments for web/api/worker, services, ingress + TLS, HPA, resource limits, Postgres/Redis/MinIO (or managed storage), CronJobs
- Observability: structured logs, basic metrics, error tracking
- E2E tests (Playwright) for the main flow; load test the API
- Docs: README, architecture diagram, API docs, `.env.example`, demo script with synthetic data
- Final run of `reviewer` subagent across the codebase

**Done when:** deployed on a cluster behind HTTPS, the E2E suite passes, and the demo script runs cleanly.

---

## 4. How Claude Code should work

1. At the start of each phase: restate the plan, list files to create, then implement.
2. Use plan mode for each phase; commit after each working step.
3. Follow the relevant skill for each task.
4. Write tests alongside features, and run lint, typecheck, and tests before declaring a task complete.
5. Update `/docs` and `CLAUDE.md` when conventions change.
6. Stop at the end of each phase and wait for approval before the next one.
