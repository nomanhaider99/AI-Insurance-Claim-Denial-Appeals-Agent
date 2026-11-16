import type { Db } from '../db/client.js';
import { auditLogs } from '../db/schema/index.js';

export type AuditActor = { orgId: string; userId: string | null; ip?: string | null };

/**
 * Append an audit row. `metadata` must hold ids and field names only, never PHI values.
 * See .claude/skills/phi-security.
 */
export async function audit(
  db: Db,
  actor: AuditActor,
  action: string,
  entity: { type: string; id?: string | null },
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({
    orgId: actor.orgId,
    actorUserId: actor.userId,
    action,
    entityType: entity.type,
    entityId: entity.id ?? null,
    metadata: metadata ?? null,
    ip: actor.ip ?? null,
  });
}
