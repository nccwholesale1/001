import { randomUUID } from 'node:crypto'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { hashPassword } from './auth/password.ts'
import { buyerUsers, companies, staffUsers } from './db/schema.ts'
// Explicit .ts extensions: standalone execution via `node
// --experimental-strip-types` (package.json db:seed script), same as
// db/migrate.ts — Node's own resolver, not Vite's, handles this file.
import { env } from './env.ts'

/**
 * Dev-only. Inserts a small number of obviously-fake companies/buyers/staff
 * for local testing (CLAUDE.md rule 20) — never run against a real/shared
 * database, and never wired into app startup.
 */
async function seed() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the dev seed script against NODE_ENV=production')
  }

  const client = createClient({ url: `file:${env.DATABASE_FILE}` })
  const db = drizzle({ client })

  const companyId = randomUUID()
  await db.insert(companies).values({ id: companyId, name: '[Fixture] Test Traders Ltd' })

  await db.insert(buyerUsers).values([
    {
      id: randomUUID(),
      companyId,
      name: '[Fixture] Alex Buyer',
      email: 'fixture.buyer@ncc-supply.test',
      role: 'buyer',
      status: 'active',
    },
    {
      id: randomUUID(),
      companyId,
      name: '[Fixture] Sam Admin',
      email: 'fixture.company-admin@ncc-supply.test',
      role: 'company_admin',
      status: 'active',
    },
  ])

  await db.insert(staffUsers).values([
    {
      id: randomUUID(),
      name: '[Fixture] Jordan NCC Admin',
      email: 'fixture.ncc-admin@ncc-supply.test',
      username: 'fixture.ncc-admin',
      passwordHash: await hashPassword('fixture-dev-password-only'),
      role: 'ncc_admin',
      status: 'active',
    },
    {
      id: randomUUID(),
      name: '[Fixture] Riley Sales Rep',
      email: 'fixture.sales-rep@ncc-supply.test',
      username: 'fixture.sales-rep',
      passwordHash: await hashPassword('fixture-dev-password-only'),
      role: 'sales_rep',
      employeeId: 'FIXTURE-001',
      status: 'pending_id_verification',
    },
  ])

  console.log(`Seeded fixture data into ${env.DATABASE_FILE}`)
  client.close()
}

await seed()
