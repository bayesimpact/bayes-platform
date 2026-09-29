// This file runs before each test file

import { resolve } from "node:path"
import { config as dotenvConfig } from "dotenv"

// Explicitly load .env.test to ensure it takes precedence.
// `quiet` keeps test output clean by disabling dotenv's injected env log.
dotenvConfig({ path: resolve(__dirname, ".env.test"), override: true, quiet: true })

if (process.env.TEST_USE_WORKER_DATABASE === "true") {
  const workerId = process.env.JEST_WORKER_ID ?? "1"
  const baseDatabaseUrl = process.env.DATABASE_URL

  if (!baseDatabaseUrl) {
    throw new Error(
      "DATABASE_URL is required when TEST_USE_WORKER_DATABASE=true. Ensure .env.test provides it.",
    )
  }

  const parsedDatabaseUrl = new URL(baseDatabaseUrl)
  const baseDatabaseName = parsedDatabaseUrl.pathname.replace(/^\//, "")

  if (!baseDatabaseName) {
    throw new Error(`Invalid DATABASE_URL without database name: ${baseDatabaseUrl}`)
  }

  const workerDatabaseName = `${baseDatabaseName}_w${workerId}`
  parsedDatabaseUrl.pathname = `/${workerDatabaseName}`
  process.env.DATABASE_URL = parsedDatabaseUrl.toString()
  process.env.DATABASE_NAME = workerDatabaseName
}

// Bull Board registers `forFeature` from domain modules but `forRoot` only exists on `AppModule`; never enable in Jest.
delete process.env.BULL_BOARD_ENABLED
