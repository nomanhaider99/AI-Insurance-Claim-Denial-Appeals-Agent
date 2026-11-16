---
name: testing
description: Testing conventions for AppealAI — Vitest unit tests, Supertest API tests, Playwright e2e, synthetic fixtures, and what must be tested for every feature (auth, tenancy, validation, AI output). Use when writing or reviewing any feature or test.
---

# Testing

## Layers

| Layer                                             | Tool               | Location                                  | Runs in                    |
| ------------------------------------------------- | ------------------ | ----------------------------------------- | -------------------------- |
| Unit (pure logic, schemas, processors with mocks) | Vitest             | `src/**/*.test.ts` next to the code       | `pnpm test`                |
| API (HTTP through `createApp`)                    | Vitest + Supertest | `apps/api/test/*.test.ts`                 | `pnpm test`                |
| Integration (real Postgres/Redis)                 | Vitest             | `apps/api/test/integration/*.int.test.ts` | CI with service containers |
| E2E (browser, full stack)                         | Playwright         | `apps/web/e2e/*.spec.ts`                  | Compose stack, Phase 5–6   |

## Conventions

- Build the app with `createApp({...deps})` and inject fakes (see `apps/api/test/app.test.ts`). Don't start a real server or touch real infra in unit/API tests.
- Integration tests use a dedicated DB, run migrations once, and isolate each test with a transaction or truncation.
- **Fixtures are synthetic.** Use factory helpers (`makeOrg`, `makeUser`, `makeClaim`) with fake values. No real names, DOBs, member ids or real denial letters.
- **Mock the Claude API** in all automated tests. Use recorded synthetic responses. Never call the live API in CI.
- Test names describe behaviour: `'biller cannot approve an appeal'`.
- Assert the shared error shape with `apiErrorSchema.parse(res.body)`.
- Logs are silenced in tests (`LOG_LEVEL=silent` in `vitest.config.ts`).
- No snapshots of large HTML or JSON. Assert the fields that matter.

## Must test for every feature

- [ ] Happy path
- [ ] Validation: bad input → 400 `VALIDATION_ERROR` with field details
- [ ] Auth: no token → 401
- [ ] Roles: each role allowed/denied as specified → 403
- [ ] **Tenancy:** a user from org B gets 404 on org A's resource, and lists exclude it
- [ ] Audit row written for claim-data reads/writes
- [ ] AI jobs: valid output saved with `ai_meta`; invalid output rejected; re-running is idempotent
- [ ] RAG: citations reference retrieved chunks and quotes match
- [ ] UI: loading, error and empty states (unit or e2e)

## Done means

`pnpm lint && pnpm typecheck && pnpm test` pass locally, and CI is green.
