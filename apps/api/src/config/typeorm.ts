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
  entities: [`${__dirname}/../**/*.entity.{js,ts}`],
  migrations: [`${__dirname}/../**/migrations/*.{js,ts}`],
  autoLoadEntities: true,
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === "true",
  extra,
})

// DataSource for migrations (uses source files for CLI operations)
// This is used by TypeORM CLI for running migrations
const baseConfig = config()
const { autoLoadEntities, ...dataSourceConfig } = baseConfig
export const connectionSource = new DataSource({
  ...dataSourceConfig,
  entities: ["src/**/*.entity.ts"],
  migrations: ["src/**/migrations/*.ts"],
} as DataSourceOptions)

export default registerAs("typeorm", () => config)
