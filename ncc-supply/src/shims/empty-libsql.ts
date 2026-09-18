/** Empty stand-in so Nitro never `require`s `@libsql/linux-x64-gnu` at runtime. */
export default class LibsqlStub {
  constructor() {
    throw new Error('Native libsql is not available in the hosted bundle')
  }
}
