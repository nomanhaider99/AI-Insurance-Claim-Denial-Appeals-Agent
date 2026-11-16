---
name: auth-rbac
description: Authentication and role-based access control for AppealAI. Use when adding or changing login, registration, logout, token refresh, password reset, invites, session cookies, CSRF, roles (admin, reviewer, biller), requireAuth/requireRole middleware, or rate limiting on auth routes.
---

# Auth & RBAC

## Conventions

- **Passwords:** hash with `argon2` (`argon2id`, library defaults or stronger). Never log, return or store plaintext. Compare only with `argon2.verify`.
- **Tokens:** short-lived JWT access token (≈15 min) plus an opaque refresh token (≈7–30 days).
  - Both go in **httpOnly, Secure (prod), SameSite=Lax** cookies. Never put them in localStorage or response bodies.
  - Store only a **hash** of each refresh token in the DB, with `userId`, `orgId`, `familyId`, `expiresAt`, `revokedAt`.
  - **Rotation:** every refresh issues a new refresh token and revokes the old one. If a revoked token is reused, revoke the whole family (theft detection).
  - Logout revokes the current refresh token and clears both cookies.
- **JWT claims:** `sub` (userId), `org` (orgId), `role`. Sign with `JWT_ACCESS_SECRET` (≥32 chars, validated in `env.ts`). Verify algorithm explicitly.
- **CSRF:** because auth uses cookies, every state-changing request (POST/PUT/PATCH/DELETE) must pass a CSRF check. Use the double-submit token: a non-httpOnly `csrf` cookie plus an `X-CSRF-Token` header that must match. Also check `Origin` against `WEB_ORIGIN`.
- **Roles:** `admin | reviewer | biller` from `@appeal/shared` (`roles`).
  - `admin`: manage org, users, invites, settings, plus everything below.
  - `reviewer`: review, edit, approve or reject appeals.
  - `biller`: upload denials, edit extracted data, request drafts. Cannot approve.
- **Middleware** (in `apps/api/src/middleware/`):
  - `requireAuth`: verifies the access token and sets `req.auth = { userId, orgId, role }`. Otherwise `401 UNAUTHORIZED`.
  - `requireRole(...roles)`: `403 FORBIDDEN` unless `req.auth.role` is in the list. Always place it after `requireAuth`.
  - `orgId` comes **only** from `req.auth`, never from the body, query or params.
- **Rate limiting:** login, register, refresh and password-reset routes are rate limited per IP and per email (e.g. 5/min for login). Return `429 RATE_LIMITED` in the shared error shape.
- **Errors:** login failures always say "Invalid email or password". Never reveal whether an email exists. Password reset always returns 200.
- **Password reset:** single-use random token, store only its hash, expires in ≤1h. Email is a console stub until a provider is added.

## Checklist

- [ ] argon2id hashing; no plaintext passwords anywhere (logs, responses, DB)
- [ ] Access and refresh tokens only in httpOnly cookies; refresh tokens stored hashed
- [ ] Refresh rotates the token; reusing a revoked token revokes the whole family
- [ ] CSRF check on every mutating route, plus an Origin check
- [ ] `requireAuth` then `requireRole` on every protected route; `orgId` taken from the token only
- [ ] Rate limits on auth routes, returning 429 in the shared error format
- [ ] Tests: login ok/fail, refresh rotation + reuse detection, logout, role allowed/denied per route, CSRF missing → 403
- [ ] Every auth event (login, logout, failed login, role change) written to `audit_logs`
