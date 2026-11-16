---
name: api-endpoint
description: How to add or change an Express API endpoint in apps/api — route → controller → service → repository layering, Zod validation, the shared error format, pagination and OpenAPI comments. Use for any new or modified HTTP route.
---

# API endpoint

## Layout (per feature, e.g. `claims`)

```
apps/api/src/features/claims/
  claims.routes.ts       Router: path + middleware (requireAuth, requireRole, validate) → controller
  claims.controller.ts   HTTP only: read req.auth/validated input, call service, send response
  claims.service.ts      Business rules, transactions, audit logging, queue jobs. No req/res.
  claims.repository.ts   Drizzle queries only. orgId is the first arg of every function.
  claims.schemas.ts      Zod request/response schemas (shared ones go in packages/shared)
apps/api/test/claims.test.ts
```

Mount the feature router in the `apiRouter` passed to `createApp` (served under `/api/v1`).

## Rules

- **Validation:** parse `req.body`, `req.query` and `req.params` with Zod before the controller uses them. A thrown `ZodError` becomes `400 VALIDATION_ERROR` through `errorHandler`. Never trust unparsed input.
- **Errors:** throw `new AppError(code, message, details?)` from `src/lib/errors.ts`. Never send error JSON by hand. The shape is always `{ error: { code, message, details? } }` (`apiErrorSchema` in `@appeal/shared`). 500s never leak internal messages.
- **Express 5** forwards async errors automatically; don't wrap handlers in try/catch just to call `next`.
- **Pagination:** list endpoints take `paginationQuerySchema` (`page`, `pageSize` ≤ 100) and return `{ data, page, pageSize, total }`. Sort deterministically (e.g. `created_at desc, id`).
- **Responses:** return explicit DTOs. Never return `passwordHash`, token hashes or raw extraction text unless the endpoint is meant to.
- **Status codes:** 200 read/update, 201 create (+ resource body), 204 delete, 202 when a job was queued.
- **Layer boundaries:** controllers never import `db`; repositories never throw HTTP errors; services never touch `req`/`res`.
- **Tenancy + auth:** see `multi-tenancy` and `auth-rbac`. Writes to claim data are audited (see `phi-security`).
- **OpenAPI comments:** document each route above its definition:
  ```ts
  /**
   * @openapi
   * /api/v1/claims:
   *   get:
   *     summary: List claims for the caller's org
   *     tags: [claims]
   *     parameters: [{ in: query, name: page, schema: { type: integer } }]
   *     responses: { 200: { description: Paginated claims }, 401: { description: Unauthorized } }
   */
  ```

## Checklist

- [ ] Routes, controller, service and repository are in separate files
- [ ] Zod validates every input; response is an explicit DTO
- [ ] Errors are thrown as `AppError` and come out in the shared format
- [ ] `requireAuth`/`requireRole` applied; queries scoped by `orgId`
- [ ] List endpoint is paginated with a deterministic order
- [ ] `@openapi` comment on each route
- [ ] Supertest tests: happy path, validation 400, 401, 403 by role, cross-org 404
