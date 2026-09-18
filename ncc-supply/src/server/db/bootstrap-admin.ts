import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { z } from 'zod'
import * as schema from './schema.ts'
import { env } from '../env.ts'
import { bootstrapFirstNccAdmin } from '../staff/bootstrap-admin.ts'

/**
 * Standalone CLI (`pnpm db:bootstrap-admin`). Creates the first NCC admin
 * against DATABASE_URL (hosted) or DATABASE_FILE (local). Refuses if an
 * ncc_admin already exists. Not imported by the app.
 */
const inputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
})

function readBootstrapInput() {
  return inputSchema.parse({
    name: process.env.STAFF_BOOTSTRAP_NAME,
    email: process.env.STAFF_BOOTSTRAP_EMAIL,
    username: process.env.STAFF_BOOTSTRAP_USERNAME,
    password: process.env.STAFF_BOOTSTRAP_PASSWORD,
  })
}

const client = env.DATABASE_URL
  ? createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })
  : createClient({ url: `file:${env.DATABASE_FILE}` })
const db = drizzle({ client, schema })

const input = readBootstrapInput()
const { staffUserId } = await bootstrapFirstNccAdmin(db, input)
console.log(`Created first NCC admin ${input.email} (${staffUserId})`)
client.close()
