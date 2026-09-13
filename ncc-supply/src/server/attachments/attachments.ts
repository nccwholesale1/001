import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { attachments, type AttachmentOwnerType } from '../db/schema'

export class AttachmentTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Attachments must be ${Math.floor(maxBytes / (1024 * 1024))}MB or smaller`)
    this.name = 'AttachmentTooLargeError'
  }
}

export class UnsupportedAttachmentTypeError extends Error {
  constructor() {
    super('That file type is not supported — attach a JPEG, PNG, WebP, GIF or PDF')
    this.name = 'UnsupportedAttachmentTypeError'
  }
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

/**
 * Detects the real file type from its own magic bytes — never trusts the
 * client-claimed MIME type or filename extension (CLAUDE.md rule 21
 * "validate attachments by content, size and type"; the runbook's own test
 * list calls for "attachment attacks", i.e. a malicious file renamed/
 * relabelled as an image). Returns null for anything not on the allowlist.
 */
function sniffContentType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (
    bytes.length >= 6 &&
    (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif'
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf'
  }
  return null
}

export interface AttachmentInput {
  filename: string
  /** Base64-encoded file contents, as read client-side. */
  base64: string
}

/**
 * Decodes, size-checks, and content-sniffs an uploaded attachment before
 * storing it — never trusts the size/type the client reports, since both
 * are cheap to spoof (rule 21). Throws a specific, user-facing error for
 * each failure mode rather than a generic one, so the form can explain
 * what's wrong instead of just failing.
 */
export async function storeAttachment(
  db: Db,
  ownerType: AttachmentOwnerType,
  ownerId: string,
  input: AttachmentInput,
): Promise<{ id: string }> {
  const data = Buffer.from(input.base64, 'base64')
  if (data.length === 0 || data.length > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentTooLargeError(MAX_ATTACHMENT_BYTES)
  }

  const contentType = sniffContentType(data)
  if (!contentType) throw new UnsupportedAttachmentTypeError()

  const id = randomUUID()
  await db.insert(attachments).values({
    id,
    ownerType,
    ownerId,
    filename: input.filename.slice(0, 255),
    contentType,
    sizeBytes: data.length,
    data,
  })
  return { id }
}

export interface StoredAttachment {
  filename: string
  contentType: string
  data: Buffer
  ownerType: AttachmentOwnerType
  ownerId: string
}

/** Pure fetch, no authorization — same "caller's job to authorize" contract as buildOrderRequestView etc. */
export async function getAttachment(db: Db, attachmentId: string): Promise<StoredAttachment | null> {
  const [row] = await db.select().from(attachments).where(eq(attachments.id, attachmentId)).limit(1)
  if (!row) return null
  return {
    filename: row.filename,
    contentType: row.contentType,
    data: row.data as Buffer,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
  }
}
