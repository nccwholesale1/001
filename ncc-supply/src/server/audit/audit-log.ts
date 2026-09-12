import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { auditEvents, type AuditActorType } from '../db/schema'

export interface AuditEventInput {
  actorType: AuditActorType
  /** Null for a 'guest' or 'system' actor with no persisted identity. */
  actorId: string | null
  action: string
  resourceType: string
  resourceId: string
  detail?: Record<string, unknown>
}

/**
 * Append-only by design: this module exports no update or delete function,
 * so a compliant caller has no way to alter or remove an audit row through
 * this boundary — only ever add new ones.
 */
export async function recordAuditEvent(db: Db, event: AuditEventInput): Promise<void> {
  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    detailJson: event.detail ? JSON.stringify(event.detail) : null,
  })
}
