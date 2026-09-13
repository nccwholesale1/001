import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { AttachmentTooLargeError, getAttachment, storeAttachment, UnsupportedAttachmentTypeError } from './attachments'

const REAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

describe('storeAttachment', () => {
  it('accepts a real PNG and sniffs its content type from magic bytes, not the filename', async () => {
    const { db, client } = await createTestDb()
    try {
      const { id } = await storeAttachment(db, 'return', 'return-1', {
        filename: 'evidence.txt', // deliberately mismatched extension
        base64: REAL_PNG_BASE64,
      })
      const stored = await getAttachment(db, id)
      expect(stored?.contentType).toBe('image/png')
    } finally {
      client.close()
    }
  })

  it('rejects a file whose content does not match any allowed magic bytes — the "renamed malicious file" attack', async () => {
    const { db, client } = await createTestDb()
    try {
      // Plain text pretending to be anything, via a suggestive filename.
      const fakeImage = Buffer.from('#!/bin/sh\necho "not an image"\n').toString('base64')
      await expect(
        storeAttachment(db, 'return', 'return-1', { filename: 'photo.jpg', base64: fakeImage }),
      ).rejects.toThrow(UnsupportedAttachmentTypeError)
    } finally {
      client.close()
    }
  })

  it('rejects an oversized payload regardless of claimed type', async () => {
    const { db, client } = await createTestDb()
    try {
      const oversized = Buffer.alloc(6 * 1024 * 1024, 0).toString('base64')
      await expect(
        storeAttachment(db, 'return', 'return-1', { filename: 'big.png', base64: oversized }),
      ).rejects.toThrow(AttachmentTooLargeError)
    } finally {
      client.close()
    }
  })

  it('rejects an empty payload', async () => {
    const { db, client } = await createTestDb()
    try {
      await expect(storeAttachment(db, 'return', 'return-1', { filename: 'empty.png', base64: '' })).rejects.toThrow(
        AttachmentTooLargeError,
      )
    } finally {
      client.close()
    }
  })

  it('getAttachment returns null for an unknown id', async () => {
    const { db, client } = await createTestDb()
    try {
      expect(await getAttachment(db, 'no-such-id')).toBeNull()
    } finally {
      client.close()
    }
  })
})
