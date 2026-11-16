import { and, desc, eq, isNull } from 'drizzle-orm';
import type { InviteDto } from '@appeal/shared';
import type { Db } from '../../db/client.js';
import { invites, organizations } from '../../db/schema/index.js';

export type InviteRow = typeof invites.$inferSelect;

export function toInviteDto(i: InviteRow): InviteDto {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt.toISOString(),
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

/** Org-scoped queries. orgId is always the first argument. */
export function orgRepository(db: Db) {
  return {
    async findOrg(orgId: string) {
      const [row] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      return row;
    },

    async listPendingInvites(orgId: string): Promise<InviteRow[]> {
      return db
        .select()
        .from(invites)
        .where(and(eq(invites.orgId, orgId), isNull(invites.acceptedAt)))
        .orderBy(desc(invites.createdAt), desc(invites.id));
    },

    async insertInvite(values: typeof invites.$inferInsert & { orgId: string }) {
      const [row] = await db.insert(invites).values(values).returning();
      if (!row) throw new Error('insert returned no row');
      return row;
    },

    /** Removes earlier pending invites for the same email so only the newest link works. */
    async deletePendingInvitesFor(orgId: string, email: string) {
      await db
        .delete(invites)
        .where(and(eq(invites.orgId, orgId), eq(invites.email, email), isNull(invites.acceptedAt)));
    },

    async deletePendingInvite(orgId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(invites)
        .where(and(eq(invites.orgId, orgId), eq(invites.id, id), isNull(invites.acceptedAt)))
        .returning({ id: invites.id });
      return rows.length > 0;
    },
  };
}
