import { randomUUID } from 'node:crypto';
import type {
  AcceptInviteInput,
  ForgotPasswordInput,
  LoginInput,
  MeResponse,
  RegisterInput,
  ResetPasswordInput,
} from '@appeal/shared';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@appeal/shared';
import type { Db } from '../../db/client.js';
import type { AppConfig } from '../../config.js';
import type { Mailer } from '../../lib/mailer.js';
import { AppError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { logger } from '../../logger.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password.js';
import {
  REFRESH_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
  randomToken,
  sha256,
  signAccessToken,
  type AuthContext,
} from '../../lib/tokens.js';
import { toUserDto, usersRepository, type UserRow } from '../users/users.repository.js';
import { authRepository } from './auth.repository.js';

export type IssuedTokens = { accessToken: string; refreshToken: string };
type Ctx = { ip?: string };

const INVALID_LOGIN = 'Invalid email or password';
/** Concurrent refreshes (e.g. two tabs) within this window aren't treated as token theft. */
const REFRESH_REUSE_GRACE_MS = 20_000;

export function authService(deps: { db: Db; config: AppConfig; mailer: Mailer }) {
  const { db, config, mailer } = deps;
  const users = usersRepository(db);
  const repo = authRepository(db);

  async function issueTokens(user: UserRow, familyId: string = randomUUID()) {
    const refreshToken = randomToken();
    const row = await repo.insertRefreshToken({
      orgId: user.orgId,
      userId: user.id,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    const accessToken = await signAccessToken(
      { userId: user.id, orgId: user.orgId, role: user.role, sessionVersion: user.sessionVersion },
      config.jwtAccessSecret,
    );
    return { tokens: { accessToken, refreshToken }, refreshTokenId: row.id };
  }

  async function me(auth: AuthContext): Promise<MeResponse> {
    const user = await users.findById(auth.orgId, auth.userId);
    const org = await repo.findOrg(auth.orgId);
    if (!user || !org) throw new AppError('UNAUTHORIZED', 'Authentication required');
    return {
      user: toUserDto(user),
      organization: { id: org.id, name: org.name, slug: org.slug },
    };
  }

  const authOf = (u: UserRow): AuthContext => ({ userId: u.id, orgId: u.orgId, role: u.role });

  return {
    me,

    /** Creates a new organization and its first admin, then signs them in. */
    async register(input: RegisterInput, ctx: Ctx) {
      const data = registerSchema.parse(input);
      if (await users.findByEmailForAuth(data.email)) {
        throw new AppError('CONFLICT', 'An account with this email already exists');
      }
      const passwordHash = await hashPassword(data.password);
      const user = await db.transaction(async (tx) => {
        const txRepo = authRepository(tx);
        const org = await txRepo.insertOrg(data.orgName, slugify(data.orgName));
        return usersRepository(tx).insert({
          orgId: org.id,
          email: data.email,
          name: data.name,
          passwordHash,
          role: 'admin',
        });
      });
      await audit(db, { orgId: user.orgId, userId: user.id, ip: ctx.ip }, 'org.created', {
        type: 'organization',
        id: user.orgId,
      });
      const { tokens } = await issueTokens(user);
      return { tokens, me: await me(authOf(user)) };
    },

    async login(input: LoginInput, ctx: Ctx) {
      const data = loginSchema.parse(input);
      const user = await users.findByEmailForAuth(data.email);
      if (!user) {
        await burnPasswordCheck(data.password);
        throw new AppError('UNAUTHORIZED', INVALID_LOGIN);
      }
      if (!(await verifyPassword(user.passwordHash, data.password))) {
        await audit(db, { orgId: user.orgId, userId: user.id, ip: ctx.ip }, 'auth.login_failed', {
          type: 'user',
          id: user.id,
        });
        throw new AppError('UNAUTHORIZED', INVALID_LOGIN);
      }
      await users.touchLogin(user.orgId, user.id);
      await audit(db, { orgId: user.orgId, userId: user.id, ip: ctx.ip }, 'auth.login', {
        type: 'user',
        id: user.id,
      });
      const { tokens } = await issueTokens(user);
      return { tokens, me: await me(authOf(user)) };
    },

    /**
     * Rotates the refresh token. Presenting a revoked token means it was stolen or replayed:
     * the whole token family is revoked and the user must sign in again.
     */
    async refresh(rawToken: string | undefined, ctx: Ctx): Promise<IssuedTokens> {
      if (!rawToken) throw new AppError('UNAUTHORIZED', 'Session expired');
      const row = await repo.findRefreshTokenByHash(sha256(rawToken));
      if (!row) throw new AppError('UNAUTHORIZED', 'Session expired');

      // Two tabs refreshing with the same cookie at the same moment is normal, not theft:
      // within a short grace window after rotation, the old token may rotate again.
      const inGrace =
        row.revokedAt !== null &&
        row.replacedById !== null &&
        Date.now() - row.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;

      if (row.revokedAt && !inGrace) {
        await repo.revokeFamily(row.orgId, row.familyId);
        await audit(
          db,
          { orgId: row.orgId, userId: row.userId, ip: ctx.ip },
          'auth.refresh_reuse',
          {
            type: 'user',
            id: row.userId,
          },
        );
        logger.warn({ orgId: row.orgId, userId: row.userId }, 'refresh token reuse detected');
        throw new AppError('UNAUTHORIZED', 'Session expired');
      }
      if (row.expiresAt <= new Date()) throw new AppError('UNAUTHORIZED', 'Session expired');

      const user = await users.findById(row.orgId, row.userId);
      if (!user) throw new AppError('UNAUTHORIZED', 'Session expired');

      const { tokens, refreshTokenId } = await issueTokens(user, row.familyId);
      // If a concurrent refresh already revoked it, that's the grace case above: both
      // callers keep valid tokens in the same family.
      if (!inGrace) await repo.revokeRefreshToken(row.orgId, row.id, refreshTokenId);
      return tokens;
    },

    async logout(rawToken: string | undefined) {
      if (!rawToken) return;
      const row = await repo.findRefreshTokenByHash(sha256(rawToken));
      if (row) await repo.revokeRefreshToken(row.orgId, row.id);
    },

    /** Always succeeds, so the response doesn't reveal whether the email exists. */
    async forgotPassword(input: ForgotPasswordInput, ctx: Ctx) {
      const data = forgotPasswordSchema.parse(input);
      const user = await users.findByEmailForAuth(data.email);
      if (!user) return;
      const token = randomToken();
      // Only the newest reset link works.
      await repo.invalidateResetTokens(user.orgId, user.id);
      await repo.insertResetToken({
        orgId: user.orgId,
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
      await audit(db, { orgId: user.orgId, userId: user.id, ip: ctx.ip }, 'auth.reset_requested', {
        type: 'user',
        id: user.id,
      });
      await mailer.send({
        to: user.email,
        subject: 'Reset your AppealAI password',
        text: 'Use the link to set a new password. It expires in 1 hour.',
        link: `${config.appUrl}/reset-password?token=${token}`,
      });
    },

    async resetPassword(input: ResetPasswordInput, ctx: Ctx) {
      const data = resetPasswordSchema.parse(input);
      const passwordHash = await hashPassword(data.password);
      const row = await db.transaction(async (tx) => {
        const consumed = await authRepository(tx).consumeResetToken(sha256(data.token));
        if (!consumed) return undefined;
        // Also kills every existing access token (requireAuth checks session_version).
        await usersRepository(tx).updatePassword(consumed.orgId, consumed.userId, passwordHash);
        await authRepository(tx).revokeAllForUser(consumed.orgId, consumed.userId);
        await authRepository(tx).invalidateResetTokens(consumed.orgId, consumed.userId);
        return consumed;
      });
      if (!row) throw new AppError('VALIDATION_ERROR', 'This reset link is invalid or has expired');
      await audit(db, { orgId: row.orgId, userId: row.userId, ip: ctx.ip }, 'auth.password_reset', {
        type: 'user',
        id: row.userId,
      });
    },

    /** Creates the invited user in the invite's org with the invite's role, then signs them in. */
    async acceptInvite(input: AcceptInviteInput, ctx: Ctx) {
      const data = acceptInviteSchema.parse(input);
      const passwordHash = await hashPassword(data.password);
      const user = await db.transaction(async (tx) => {
        const invite = await authRepository(tx).consumeInvite(sha256(data.token));
        if (!invite) return undefined;
        if (await usersRepository(tx).findByEmailForAuth(invite.email)) {
          throw new AppError('CONFLICT', 'An account with this email already exists');
        }
        return usersRepository(tx).insert({
          orgId: invite.orgId,
          email: invite.email,
          name: data.name,
          passwordHash,
          role: invite.role,
        });
      });
      if (!user) throw new AppError('VALIDATION_ERROR', 'This invite is invalid or has expired');
      await audit(db, { orgId: user.orgId, userId: user.id, ip: ctx.ip }, 'invite.accepted', {
        type: 'user',
        id: user.id,
      });
      const { tokens } = await issueTokens(user);
      return { tokens, me: await me(authOf(user)) };
    },
  };
}

export type AuthService = ReturnType<typeof authService>;

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'org';
  return `${base}-${randomToken().slice(0, 6).toLowerCase()}`;
}
