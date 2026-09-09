import * as process from "node:process"
import { registerAs } from "@nestjs/config"
import type { TypeOrmModuleOptions } from "@nestjs/typeorm"
import { config as dotenvConfig } from "dotenv"
import { DataSource, type DataSourceOptions } from "typeorm"

dotenvConfig({ path: ".env" })

let extra = {}
if (process.env.DATABASE_HOST?.startsWith("/cloudsql")) {
  extra = {
    socketPath: process.env.DATABASE_HOST,
  }
}

const databaseUrl = process.env.DATABASE_URL

/**
 * TLS towards the database. Managed instances (Cloud SQL in ENCRYPTED_ONLY
 * mode, RDS...) refuse plain connections.
 *
 * DATABASE_SSL unset, "false" or "disable": no TLS (local Docker Postgres).
 * DATABASE_SSL=require: encrypted, server certificate not verified. Cloud SQL
 *   signs its certificate with a per-instance CA, so this is the usual setting
 *   inside a private network.
 * DATABASE_SSL=verify-full: encrypted and verified against DATABASE_SSL_CA
 *   (the CA certificate, PEM).
 */
function sslOptions(): { ssl?: { rejectUnauthorized: boolean; ca?: string } } {
  const mode = process.env.DATABASE_SSL?.trim().toLowerCase()
  if (!mode || mode === "false" || mode === "disable") return {}
  if (mode === "verify-full") {
    const ca = process.env.DATABASE_SSL_CA
    if (!ca) throw new Error("DATABASE_SSL=verify-full requires DATABASE_SSL_CA (PEM certificate)")
    return { ssl: { rejectUnauthorized: true, ca } }
  }
  return { ssl: { rejectUnauthorized: false } }
}

export const config: () => TypeOrmModuleOptions = () => ({
  type: "postgres",
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : undefined,
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
      }),
  ...sslOptions(),
  entities: [`${__dirname}/../**/*.entity.{js,ts}`],
  migrations: [`${__dirname}/../**/migrations/*.{js,ts}`],
  autoLoadEntities: true,
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === "true",
  extra,
})

// DataSource for the TypeORM CLI (migration:run, migration:generate...).
// The globs are relative to this file, so the same DataSource works from the
// sources with ts-node (`npm run migration:run`) and from the compiled `dist/`
// in the runtime image (`npm run migration:run:prod`, used by the Kubernetes
// migration job). From `src/` the pattern only matches `.ts` files, from
// `dist/` only `.js` files, so nothing is loaded twice.
const baseConfig = config()
const { autoLoadEntities, ...dataSourceConfig } = baseConfig
export const connectionSource = new DataSource({
  ...dataSourceConfig,
  entities: [`${__dirname}/../**/*.entity.{js,ts}`],
  migrations: [`${__dirname}/../**/migrations/*.{js,ts}`],
} as DataSourceOptions)

export default registerAs("typeorm", () => config)
