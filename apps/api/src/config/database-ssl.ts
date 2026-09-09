/**
 * TLS towards the database, for every Postgres client of the API: the TypeORM
 * data source and the raw `pg` clients (LISTEN/NOTIFY listeners). Managed
 * instances (Cloud SQL in ENCRYPTED_ONLY mode, RDS...) refuse plain
 * connections.
 *
 * DATABASE_SSL unset, "false" or "disable": no TLS (local Docker Postgres).
 * DATABASE_SSL=require: encrypted, server certificate not verified. Cloud SQL
 *   signs its certificate with a per-instance CA, so this is the usual setting
 *   inside a private network.
 * DATABASE_SSL=verify-full: encrypted and verified against DATABASE_SSL_CA
 *   (the CA certificate, PEM).
 */
export type DatabaseSslOptions = { ssl?: { rejectUnauthorized: boolean; ca?: string } }

export function databaseSslOptions(env: NodeJS.ProcessEnv = process.env): DatabaseSslOptions {
  const mode = env.DATABASE_SSL?.trim().toLowerCase()
  if (!mode || mode === "false" || mode === "disable") return {}
  if (mode === "verify-full") {
    const ca = env.DATABASE_SSL_CA
    if (!ca) throw new Error("DATABASE_SSL=verify-full requires DATABASE_SSL_CA (PEM certificate)")
    return { ssl: { rejectUnauthorized: true, ca } }
  }
  return { ssl: { rejectUnauthorized: false } }
}
