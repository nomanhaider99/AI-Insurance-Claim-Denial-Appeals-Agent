import { and, asc, count, eq } from 'drizzle-orm';
import type { Role, UserDto } from '@appeal/shared';
import type { Db } from '../../db/client.js';
import { users } from '../../db/schema/index.js';

export type UserRow = typeof users.$inferSelect;

export function toUserDto(u: UserRow): UserDto {
  return {
    id: u.id,
    orgId: u.orgId,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  };
}

/** Org-scoped user queries. orgId is always the first argument. */
export function usersRepository(db: Db) {
  return {
    async findById(orgId: string, id: string): Promise<UserRow | undefined> {
      const [row] = await db
        .select()
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.id, id)));
      return row;
    },

    async list(orgId: string, page: number, pageSize: number) {
      const where = eq(users.orgId, orgId);
      const [rows, [total]] = await Promise.all([
        db
          .select()
          .from(users)
          .where(where)
          .orderBy(asc(users.createdAt), asc(users.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(users).where(where),
      ]);
      return { rows, total: total?.n ?? 0 };
    },

    async countByRole(orgId: string, role: Role): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.role, role)));
      return row?.n ?? 0;
    },

    async updateRole(orgId: string, id: string, role: Role): Promise<UserRow | undefined> {
      const [row] = await db
        .update(users)
        .set({ role })
        .where(and(eq(users.orgId, orgId), eq(users.id, id)))
        .returning();
      return row;
    },

    async updatePassword(orgId: string, id: string, passwordHash: string): Promise<void> {
      await db
        .update(users)
        .set({ passwordHash })
        .where(and(eq(users.orgId, orgId), eq(users.id, id)));
    },

    async touchLogin(orgId: string, id: string): Promise<void> {
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(and(eq(users.orgId, orgId), eq(users.id, id)));
    },

    async insert(values: typeof users.$inferInsert): Promise<UserRow> {
      const [row] = await db.insert(users).values(values).returning();
      if (!row) throw new Error('insert returned no row');
      return row;
    },

    /**
     * Global lookup by email — the one deliberate unscoped query: login/registration
     * happen before we know the org. Emails are unique across all orgs.
     */
    async findByEmailForAuth(email: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(eq(users.email, email));
      return row;
    },
  };
}
