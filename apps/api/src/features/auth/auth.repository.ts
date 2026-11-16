import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import {
  invites,
  organizations,
  passwordResetTokens,
  refreshTokens,
} from '../../db/schema/index.js';

/**
 * Token lookups by hash are unscoped on purpose: the secret token itself identifies
 * the row (and its org_id) before any session exists. Everything else is org-scoped.
 */
export function authRepository(db: Db) {
  return {
    async findOrg(orgId: string) {
      const [row] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      return row;
    },

    async insertOrg(name: string, slug: string) {
      const [row] = await db.insert(organizations).values({ name, slug }).returning();
      if (!row) throw new Error('insert returned no row');
      return row;
    },

    async insertRefreshToken(values: typeof refreshTokens.$inferInsert) {
      const [row] = await db.insert(refreshTokens).values(values).returning();
      if (!row) throw new Error('insert returned no row');
      return row;
    },

    async findRefreshTokenByHash(tokenHash: string) {
      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash));
      return row;
    },

    /** Revokes one token only if still active. Returns false if it was already revoked (race/reuse). */
    async revokeRefreshToken(orgId: string, id: string, replacedById?: string): Promise<boolean> {
      const rows = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedById: replacedById ?? null })
        .where(
          and(
            eq(refreshTokens.orgId, orgId),
            eq(refreshTokens.id, id),
            isNull(refreshTokens.revokedAt),
          ),
        )
        .returning({ id: refreshTokens.id });
      return rows.length > 0;
    },

    async revokeFamily(orgId: string, familyId: string) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.orgId, orgId),
            eq(refreshTokens.familyId, familyId),
            isNull(refreshTokens.revokedAt),
          ),
        );
    },

    async revokeAllForUser(orgId: string, userId: string) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.orgId, orgId),
            eq(refreshTokens.userId, userId),
            isNull(refreshTokens.revokedAt),
          ),
        );
    },

    async insertResetToken(values: typeof passwordResetTokens.$inferInsert) {
      await db.insert(passwordResetTokens).values(values);
    },

    /** Marks a valid reset token used, atomically. Returns the row or undefined. */
    async consumeResetToken(tokenHash: string) {
      const [row] = await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      return row;
    },

    /** Marks a pending, unexpired invite accepted, atomically. */
    async consumeInvite(tokenHash: string) {
      const [row] = await db
        .update(invites)
        .set({ acceptedAt: new Date() })
        .where(
          and(
            eq(invites.tokenHash, tokenHash),
            isNull(invites.acceptedAt),
            gt(invites.expiresAt, new Date()),
          ),
        )
        .returning();
      return row;
    },
  };
}
