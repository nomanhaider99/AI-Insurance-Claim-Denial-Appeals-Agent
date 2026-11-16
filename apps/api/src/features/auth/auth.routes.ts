import { Router } from 'express';
import type { AppConfig } from '../../config.js';
import { requireAuth } from '../../middleware/auth.js';
import type { authLimiters } from '../../middleware/rate-limit.js';
import { authController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

/**
 * @openapi
 * tags: [{ name: auth, description: Sessions, registration, password reset, invites }]
 *
 * /api/v1/auth/csrf:
 *   get: { tags: [auth], summary: Issue a CSRF token (cookie + body), responses: { 200: { description: '{ csrfToken }' } } }
 * /api/v1/auth/register:
 *   post: { tags: [auth], summary: Create an organization and its first admin; sets auth cookies, responses: { 201: { description: Me }, 409: { description: Email taken } } }
 * /api/v1/auth/login:
 *   post: { tags: [auth], summary: Sign in; sets auth cookies, responses: { 200: { description: Me }, 401: { description: Invalid credentials }, 429: { description: Rate limited } } }
 * /api/v1/auth/refresh:
 *   post: { tags: [auth], summary: Rotate the refresh token and issue a new access token, responses: { 200: { description: ok }, 401: { description: Session expired } } }
 * /api/v1/auth/logout:
 *   post: { tags: [auth], summary: Revoke the refresh token and clear cookies, responses: { 204: { description: Signed out } } }
 * /api/v1/auth/me:
 *   get: { tags: [auth], summary: Current user and organization, responses: { 200: { description: Me }, 401: { description: Unauthorized } } }
 * /api/v1/auth/password/forgot:
 *   post: { tags: [auth], summary: Email a reset link if the account exists (always 200), responses: { 200: { description: ok } } }
 * /api/v1/auth/password/reset:
 *   post: { tags: [auth], summary: Set a new password with a reset token; revokes all sessions, responses: { 200: { description: ok }, 400: { description: Invalid or expired token } } }
 * /api/v1/auth/invites/accept:
 *   post: { tags: [auth], summary: Accept an invite, create the user and sign in, responses: { 201: { description: Me }, 400: { description: Invalid or expired invite } } }
 */
export function authRouter(deps: {
  service: AuthService;
  config: AppConfig;
  limiters: ReturnType<typeof authLimiters>;
}): Router {
  const c = authController(deps.service, deps.config);
  const { login, sensitive, refresh } = deps.limiters;
  const r = Router();

  r.get('/csrf', c.csrf);
  r.post('/register', sensitive, c.register);
  r.post('/login', login, c.login);
  r.post('/refresh', refresh, c.refresh);
  r.post('/logout', c.logout);
  r.get('/me', requireAuth(deps.config.jwtAccessSecret), c.me);
  r.post('/password/forgot', sensitive, c.forgotPassword);
  r.post('/password/reset', sensitive, c.resetPassword);
  r.post('/invites/accept', sensitive, c.acceptInvite);
  return r;
}
