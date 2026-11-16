---
name: multi-tenancy
description: Organization (tenant) isolation for AppealAI. Use whenever creating a table, writing a query or repository, adding an endpoint that reads or writes org data, or writing tests — every table has org_id and every query is scoped by it.
---

# Multi-tenancy

The tenant is the **organization**. Data from one org must never be readable or writable by another.

## Conventions

- **Schema:** every table except `organizations` has `org_id uuid not null references organizations(id)`. Use the `orgId()` helper in `apps/api/src/db/schema/index.ts`. Every table gets an index that starts with `org_id`. Uniques are per org where it makes sense, e.g. `(org_id, claim_number)`.
- **Source of orgId:** `req.auth.orgId`, set by `requireAuth`. Never accept `orgId` from the body, query, params or headers.
- **Repositories** take `orgId` as their **first argument** and put it in every `where`:
  ```ts
  findClaim(orgId: string, id: string) {
    return db.query.claims.findFirst({ where: and(eq(claims.orgId, orgId), eq(claims.id, id)) });
  }
  ```
  - Updates and deletes include `eq(table.orgId, orgId)` in the `where`, not just the id.
  - Inserts set `orgId` from the argument and ignore any orgId in the input.
  - Joins check `org_id` on **both** sides, or join through a parent row that was already scoped.
- **Not found, not forbidden:** a row from another org returns `404 NOT_FOUND`, so its existence is not revealed.
- **Foreign ids in input** (e.g. `claimId` in an appeal request) must be loaded through the scoped repository before use.
- **Background jobs** carry `orgId` in the job payload and scope every query by it.
- **Object storage keys** are prefixed `org/<orgId>/...`. Check the prefix before signing any URL.
- **Raw SQL** (`sql\`\``) must include `org_id = ${orgId}`. Vector search too (see `rag-retrieval`).

## Checklist

- [ ] New table has `org_id` FK + an index starting with `org_id` (except `organizations`)
- [ ] Every repository function takes `orgId` first and filters by it, including update/delete/join/vector queries
- [ ] `orgId` comes from `req.auth` only
- [ ] Cross-org access returns 404
- [ ] Job payloads and storage keys carry orgId
- [ ] **Tests:** create data in org A and org B; prove that a user in B gets 404 on GET/PATCH/DELETE of A's resource and that list endpoints never include A's rows
