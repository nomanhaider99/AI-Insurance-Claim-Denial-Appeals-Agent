import {
  createInviteSchema,
  paginationQuerySchema,
  updateRoleSchema,
  type InviteDto,
  type OrganizationDto,
  type Paginated,
  type UserDto,
} from '@appeal/shared';
import type { Db } from '../../db/client.js';
import type { AppConfig } from '../../config.js';
import type { Mailer } from '../../lib/mailer.js';
import { AppError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { INVITE_TTL_MS, randomToken, sha256, type AuthContext } from '../../lib/tokens.js';
import { toUserDto, usersRepository } from '../users/users.repository.js';
import { orgRepository, toInviteDto } from './org.repository.js';

type Ctx = { auth: AuthContext; ip?: string };

export function orgService(deps: { db: Db; config: AppConfig; mailer: Mailer }) {
  const { db, config, mailer } = deps;
  const users = usersRepository(db);
  const repo = orgRepository(db);
  const actor = (ctx: Ctx) => ({ orgId: ctx.auth.orgId, userId: ctx.auth.userId, ip: ctx.ip });

  return {
    async getOrg({ auth }: Ctx): Promise<OrganizationDto> {
      const org = await repo.findOrg(auth.orgId);
      if (!org) throw new AppError('NOT_FOUND', 'Organization not found');
      return { id: org.id, name: org.name, slug: org.slug };
    },

    async listUsers({ auth }: Ctx, query: unknown): Promise<Paginated<UserDto>> {
      const { page, pageSize } = paginationQuerySchema.parse(query);
      const { rows, total } = await users.list(auth.orgId, page, pageSize);
      return { data: rows.map(toUserDto), page, pageSize, total };
    },

    async getUser({ auth }: Ctx, id: string): Promise<UserDto> {
      const user = await users.findById(auth.orgId, id);
      if (!user) throw new AppError('NOT_FOUND', 'User not found');
      return toUserDto(user);
    },

    async updateRole(ctx: Ctx, id: string, input: unknown): Promise<UserDto> {
      const { role } = updateRoleSchema.parse(input);
      const orgId = ctx.auth.orgId;
      // Lock the org's admin rows first so two admins demoting each other at once
      // can't leave the org with none: the second transaction re-reads after the first commits.
      const { user, updated } = await db.transaction(async (tx) => {
        const txUsers = usersRepository(tx);
        const adminIds = await txUsers.lockAdminIds(orgId);
        const user = await txUsers.findById(orgId, id);
        if (!user) throw new AppError('NOT_FOUND', 'User not found');
        if (user.role === role) return { user, updated: user };
        if (user.role === 'admin' && adminIds.length <= 1) {
          throw new AppError('CONFLICT', 'An organization must keep at least one admin');
        }
        const updated = await txUsers.updateRole(orgId, id, role);
        if (!updated) throw new AppError('NOT_FOUND', 'User not found');
        return { user, updated };
      });
      if (user.role === role) return toUserDto(updated);
      await audit(
        db,
        actor(ctx),
        'user.role_changed',
        { type: 'user', id },
        {
          from: user.role,
          to: role,
        },
      );
      return toUserDto(updated);
    },

    async listInvites({ auth }: Ctx): Promise<InviteDto[]> {
      return (await repo.listPendingInvites(auth.orgId)).map(toInviteDto);
    },

    async createInvite(ctx: Ctx, input: unknown): Promise<InviteDto> {
      const { email, role } = createInviteSchema.parse(input);
      // Only reveal existing accounts within the caller's own org (no cross-org probing).
      // An address registered elsewhere gets an invite that fails cleanly at acceptance.
      const existing = await users.findByEmailForAuth(email);
      if (existing?.orgId === ctx.auth.orgId) {
        throw new AppError('CONFLICT', 'This person is already a member');
      }
      const token = randomToken();
      const invite = await db.transaction(async (tx) => {
        const txRepo = orgRepository(tx);
        await txRepo.deletePendingInvitesFor(ctx.auth.orgId, email);
        return txRepo.insertInvite({
          orgId: ctx.auth.orgId,
          email,
          role,
          tokenHash: sha256(token),
          invitedBy: ctx.auth.userId,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        });
      });
      await audit(db, actor(ctx), 'invite.created', { type: 'invite', id: invite.id }, { role });
      await mailer.send({
        to: email,
        subject: "You've been invited to AppealAI",
        text: 'Use the link to create your account. It expires in 7 days.',
        link: `${config.appUrl}/accept-invite?token=${token}`,
      });
      return toInviteDto(invite);
    },

    async revokeInvite(ctx: Ctx, id: string): Promise<void> {
      if (!(await repo.deletePendingInvite(ctx.auth.orgId, id))) {
        throw new AppError('NOT_FOUND', 'Invite not found');
      }
      await audit(db, actor(ctx), 'invite.revoked', { type: 'invite', id });
    },
  };
}

export type OrgService = ReturnType<typeof orgService>;
