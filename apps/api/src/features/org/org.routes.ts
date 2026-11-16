import { Router, type RequestHandler } from 'express';
import { permissions } from '@appeal/shared';
import { requireRole } from '../../middleware/auth.js';
import { orgController } from './org.controller.js';
import type { OrgService } from './org.service.js';

/**
 * @openapi
 * tags: [{ name: org, description: The caller's organization, its users and invites }]
 *
 * /api/v1/org:
 *   get: { tags: [org], summary: Caller's organization (any role), responses: { 200: { description: Organization } } }
 * /api/v1/org/users:
 *   get: { tags: [org], summary: List users (admin, reviewer), parameters: [{ in: query, name: page }, { in: query, name: pageSize }], responses: { 200: { description: Paginated users }, 403: { description: Forbidden } } }
 * /api/v1/org/users/{id}:
 *   get: { tags: [org], summary: One user (admin, reviewer); 404 for other orgs, responses: { 200: { description: User }, 404: { description: Not found } } }
 * /api/v1/org/users/{id}/role:
 *   patch: { tags: [org], summary: Change a user's role (admin); keeps at least one admin, responses: { 200: { description: User }, 409: { description: Last admin } } }
 * /api/v1/org/invites:
 *   get: { tags: [org], summary: Pending invites (admin), responses: { 200: { description: '{ data: Invite[] }' } } }
 *   post: { tags: [org], summary: Invite a user by email with a role (admin), responses: { 201: { description: Invite }, 409: { description: User exists } } }
 * /api/v1/org/invites/{id}:
 *   delete: { tags: [org], summary: Revoke a pending invite (admin), responses: { 204: { description: Revoked }, 404: { description: Not found } } }
 */
export function orgRouter(deps: { service: OrgService; requireAuth: RequestHandler }): Router {
  const c = orgController(deps.service);
  const r = Router();
  r.use(deps.requireAuth);

  r.get('/', c.getOrg);
  r.get('/users', requireRole(...permissions.viewUsers), c.listUsers);
  r.get('/users/:id', requireRole(...permissions.viewUsers), c.getUser);
  r.patch('/users/:id/role', requireRole(...permissions.manageUsers), c.updateRole);
  r.get('/invites', requireRole(...permissions.manageInvites), c.listInvites);
  r.post('/invites', requireRole(...permissions.manageInvites), c.createInvite);
  r.delete('/invites/:id', requireRole(...permissions.manageInvites), c.revokeInvite);
  return r;
}
