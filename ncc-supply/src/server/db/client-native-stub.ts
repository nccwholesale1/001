import { createClient as createRemoteClient } from '@libsql/client/web'

/**
 * Production/Vercel stand-in for `client-native.ts`. Must not import
 * `@libsql/client` — that Node entry requires `@libsql/linux-x64-gnu`,
 * which is not in the serverless bundle.
 */
export function createLocalFileClient(_databaseFile: string) {
  return createRemoteClient({ url: 'https://127.0.0.1' })
}
