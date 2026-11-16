# Graph Report - AI Insurance Claim Denial Appeals Agent  (2026-11-17)

## Corpus Check
- 123 files · ~37,441 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .Dockerfile 2, .example 1)

## Summary
- 886 nodes · 1834 edges · 54 communities (51 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4dda9321`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- users/page.tsx
- web/package.json
- environment
- api-client.ts
- org.service.ts
- package.json
- helpers.ts
- api/package.json
- ci.yml
- schema/index.ts
- app.ts
- auth.service.ts
- shared/package.json
- compilerOptions
- AppealAI — AI Insurance Claim Denial Appeals Agent
- tokens.ts
- dependencies
- x-api-env
- components.json
- server.ts
- auth.controller.ts
- domain.ts
- compilerOptions
- env.ts
- worker.ts
- orgId
- scripts
- api
- AppError
- requireAuth
- services
- storage-init
- redaction.test.ts
- seed.ts
- storage
- tsconfig.build.json
- healthcheck
- api/tsconfig.json
- postgres
- shared/tsconfig.json
- AppealAI — Claude Code guide
- RAG retrieval
- allowBuilds
- migrate.ts
- app/layout.tsx
- PHI & security
- routes/health.ts
- DB migrations (Drizzle)
- Docker & Kubernetes deploy
- Testing
- .prettierrc.json
- proxy.ts
- redis

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 30 edges
2. `Card()` - 20 edges
3. `CardHeader()` - 20 edges
4. `CardTitle()` - 20 edges
5. `CardContent()` - 20 edges
6. `createApp()` - 19 edges
7. `express` - 18 edges
8. `AppError` - 18 edges
9. `Button()` - 18 edges
10. `cn()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Layout (per feature, e.g. `claims`)` --references--> `createApp()`  [INFERRED]
  .claude/skills/api-endpoint/SKILL.md → apps/api/src/app.ts
- `Layers` --references--> `createApp()`  [INFERRED]
  .claude/skills/testing/SKILL.md → apps/api/src/app.ts
- `Checklist` --references--> `audit()`  [INFERRED]
  .claude/skills/phi-security/SKILL.md → apps/api/src/lib/audit.ts
- `3. Claude Code skills to create (Phase 0)` --references--> `requireRole()`  [INFERRED]
  PLAN.md → apps/api/src/middleware/auth.ts
- `Rules` --references--> `errorHandler()`  [INFERRED]
  .claude/skills/api-endpoint/SKILL.md → apps/api/src/middleware/error-handler.ts

## Import Cycles
- None detected.

## Communities (54 total, 3 thin omitted)

### Community 0 - "users/page.tsx"
Cohesion: 0.09
Nodes (68): AcceptForm(), AcceptInvitePage(), ForgotPasswordPage(), LoginForm(), LoginPage(), RegisterPage(), ResetForm(), ResetPasswordPage() (+60 more)

### Community 1 - "web/package.json"
Cohesion: 0.05
Nodes (47): dependencies, @appeal/shared@workspace:*, class-variance-authority@^0.7.1, clsx@^2.1.1, lucide-react@^1.73.0, next@^16.4.6, @radix-ui/react-slot@^1.5.0, react@^19.3.1 (+39 more)

### Community 2 - "environment"
Cohesion: 0.10
Nodes (37): condition, environment, API_INTERNAL_URL, args, context, dockerfile, api, postgres (+29 more)

### Community 3 - "api-client.ts"
Cohesion: 0.07
Nodes (23): API_URL, ApiError, getCsrf(), isCsrfError(), NO_REFRESH, Options, parseError(), refreshSession() (+15 more)

### Community 4 - "org.service.ts"
Cohesion: 0.14
Nodes (22): Db, Schema, orgController(), InviteRow, orgRepository(), toInviteDto(), orgRouter(), Ctx (+14 more)

### Community 5 - "package.json"
Cohesion: 0.08
Nodes (30): devDependencies, eslint@^9.39.0, eslint-config-next@^16.4.6, @eslint/js@^9.39.0, globals@^17.14.0, prettier@^3.10.1, typescript@~6.0.3, typescript-eslint@^8.73.0 (+22 more)

### Community 6 - "helpers.ts"
Cohesion: 0.15
Nodes (22): users, make(), captureMailer(), createTestDb(), healthyChecks, loginAs(), makeApp(), makeOrg() (+14 more)

### Community 7 - "api/package.json"
Cohesion: 0.09
Nodes (28): devDependencies, drizzle-kit@^0.31.11, @electric-sql/pglite@^0.5.16, @electric-sql/pglite-pgvector@^0.0.17, supertest@^7.3.2, tsx@^4.23.15, @types/cookie-parser@^1.4.10, @types/express@^5.0.6 (+20 more)

### Community 8 - "ci.yml"
Cohesion: 0.07
Nodes (28): name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, jobs (+20 more)

### Community 9 - "schema/index.ts"
Cohesion: 0.11
Nodes (20): appeals, appealStatusEnum, claims, claimStatusEnum, createdAt(), denialCategoryEnum, denials, documentKindEnum (+12 more)

### Community 10 - "app.ts"
Cohesion: 0.19
Nodes (16): AppDeps, createApp(), AppConfig, authRouter(), reqSerializer(), errorHandler(), isBodyParseError(), isUniqueViolation() (+8 more)

### Community 11 - "auth.service.ts"
Cohesion: 0.13
Nodes (19): Ctx, IssuedTokens, Mailer, AcceptInviteInput, acceptInviteSchema, emailSchema, ForgotPasswordInput, forgotPasswordSchema (+11 more)

### Community 12 - "shared/package.json"
Cohesion: 0.11
Nodes (21): dependencies, zod@^4.6.7, devDependencies, @types/node@^24.0.0, typescript@~6.0.3, vitest@^4.1.12, exports, @types/node (+13 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 14 - "AppealAI — AI Insurance Claim Denial Appeals Agent"
Cohesion: 0.10
Nodes (18): Architecture, Decisions, Health, Invariants, 1. Product, 2. Stack, 3. Claude Code skills to create (Phase 0), 4. How Claude Code should work (+10 more)

### Community 15 - "tokens.ts"
Cohesion: 0.15
Nodes (17): authService(), issueTokens(), me(), slugify(), toUserDto(), AccessClaims, AuthContext, claimsSchema (+9 more)

### Community 16 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @appeal/shared@workspace:*, argon2@^0.45.2, cookie-parser@^1.4.7, drizzle-orm@^0.45.4, express@^5.3.0, express-rate-limit@^8.7.4, jose@^6.2.17 (+11 more)

### Community 17 - "x-api-env"
Cohesion: 0.11
Nodes (18): x-api-env, API_PORT, APP_URL, COOKIE_SECURE, DATABASE_URL, JWT_ACCESS_SECRET, LOG_LEVEL, MAIL_TRANSPORT (+10 more)

### Community 18 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 19 - "server.ts"
Cohesion: 0.16
Nodes (12): rate-limit-redis@^6.0.2, appConfig(), createMailer(), Mail, logger, redactPaths, app, clients (+4 more)

### Community 20 - "auth.controller.ts"
Cohesion: 0.21
Nodes (13): authController(), AuthService, ACCESS_COOKIE, base(), clearAuthCookies(), REFRESH_COOKIE, REFRESH_COOKIE_PATH, SESSION_HINT_COOKIE (+5 more)

### Community 21 - "domain.ts"
Cohesion: 0.13
Nodes (14): AppealStatus, appealStatuses, appealStatusSchema, ClaimStatus, claimStatuses, claimStatusSchema, denialCategories, DenialCategory (+6 more)

### Community 22 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, module, moduleResolution, noUncheckedIndexedAccess (+6 more)

### Community 23 - "env.ts"
Cohesion: 0.21
Nodes (10): @aws-sdk/client-s3@^3.1169.0, createDb(), Env, env(), envSchema, parseEnv(), refinedEnvSchema, createClients() (+2 more)

### Community 24 - "worker.ts"
Cohesion: 0.21
Nodes (10): bullmq@^5.81.5, ioredis@5.11.1, SYSTEM_QUEUE, SystemJob, systemQueue(), config, connection, worker (+2 more)

### Community 25 - "orgId"
Cohesion: 0.17
Nodes (10): orgId(), Agent pipeline (BullMQ + Claude), Checklist, Layout, Rules, Auth & RBAC, Conventions, Checklist (+2 more)

### Community 26 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, db:generate, db:seed, dev, dev:worker, migrate, migrate:prod (+4 more)

### Community 27 - "api"
Cohesion: 0.18
Nodes (12): depends_on, image, ports, pull_policy, migrate, redis, storage-init, condition (+4 more)

### Community 28 - "AppError"
Cohesion: 0.29
Nodes (8): CSRF_COOKIE, AppError, statusByCode, safeEqual(), csrfProtection(), refererOrigin(), SAFE_METHODS, ErrorCode

### Community 29 - "requireAuth"
Cohesion: 0.24
Nodes (9): requireAuth(), requireRole(), API endpoint, Checklist, Layout (per feature, e.g. `claims`), Rules, Checklist, Auth & tenancy (Phase 2) (+1 more)

### Community 30 - "services"
Cohesion: 0.18
Nodes (10): name, services, worker, volumes, pgdata, redisdata, storagedata, command (+2 more)

### Community 31 - "storage-init"
Cohesion: 0.18
Nodes (11): storage, AWS_ACCESS_KEY_ID, AWS_DEFAULT_REGION, AWS_SECRET_ACCESS_KEY, storage-init, condition, command, depends_on (+3 more)

### Community 33 - "seed.ts"
Cohesion: 0.27
Nodes (8): { db, pool }, orgs, roles, burnPasswordCheck(), hashPassword(), verifyPassword(), Role, drizzle-orm

### Community 34 - "storage"
Cohesion: 0.20
Nodes (10): RUSTFS_ACCESS_KEY, RUSTFS_ADDRESS, RUSTFS_CONSOLE_ADDRESS, RUSTFS_CONSOLE_ENABLE, RUSTFS_SECRET_KEY, storage, environment, image (+2 more)

### Community 35 - "tsconfig.build.json"
Cohesion: 0.22
Nodes (8): compilerOptions, declaration, outDir, rootDir, exclude, extends, include, ../../tsconfig.base.json

### Community 36 - "healthcheck"
Cohesion: 0.47
Nodes (9): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck (+1 more)

### Community 37 - "api/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, declaration, noEmit, rootDir, extends, include, ../../tsconfig.base.json

### Community 38 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, ports, volumes, postgres

### Community 39 - "shared/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, exclude, extends, include, ../../tsconfig.base.json

### Community 40 - "AppealAI — Claude Code guide"
Cohesion: 0.29
Nodes (6): AppealAI — Claude Code guide, Commands (from repo root), Conventions: follow the skill for the task, graphify, Non-negotiable rules, Stack

### Community 41 - "RAG retrieval"
Cohesion: 0.29
Nodes (6): Checklist, Citation format, Ingestion, "No source, no claim", RAG retrieval, Retrieval

### Community 42 - "allowBuilds"
Cohesion: 0.29
Nodes (6): allowBuilds, argon2, esbuild, msgpackr-extract, minimumReleaseAgeExclude, packages

### Community 43 - "migrate.ts"
Cohesion: 0.33
Nodes (4): pg@^8.23.1, migrationsFolder, pool, pg

### Community 44 - "app/layout.tsx"
Cohesion: 0.47
Nodes (3): metadata, RootLayout(), Providers()

### Community 45 - "PHI & security"
Cohesion: 0.33
Nodes (5): Audit log, Checklist, Files & storage, PHI & security, Secrets

### Community 46 - "routes/health.ts"
Cohesion: 0.50
Nodes (4): CheckName, HealthChecks, healthRouter(), withTimeout()

### Community 47 - "DB migrations (Drizzle)"
Cohesion: 0.40
Nodes (4): Checklist, DB migrations (Drizzle), Seeds, Workflow

### Community 48 - "Docker & Kubernetes deploy"
Cohesion: 0.40
Nodes (4): Docker & Kubernetes deploy, Dockerfiles (`infra/docker/`), Kubernetes (`infra/k8s/`), Rollout checklist

### Community 49 - "Testing"
Cohesion: 0.40
Nodes (4): Done means, Layers, Must test for every feature, Testing

### Community 50 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 52 - "redis"
Cohesion: 0.50
Nodes (4): image, ports, volumes, redis

## Knowledge Gaps
- **3 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 351 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `app.ts` to `org.service.ts`, `helpers.ts`, `api/package.json`, `routes/health.ts`, `dependencies`, `auth.controller.ts`, `AppError`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `apiFetch()` (e.g. with `Checklist` and `Rules`) actually correct?**
  _`apiFetch()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `users/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08716540837336993 - nodes in this community are weakly interconnected._
- **Why does `next` connect `users/page.tsx` to `redaction.test.ts`, `web/package.json`, `proxy.ts`, `app/layout.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0549645390070922 - nodes in this community are weakly interconnected._
- **Why does `react` connect `users/page.tsx` to `web/package.json`, `app/layout.tsx`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._