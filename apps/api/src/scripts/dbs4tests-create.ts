import { cpus } from "node:os"
import { resolve } from "node:path"
import { config as dotenvConfig } from "dotenv"
import { Client } from "pg"

dotenvConfig({ path: resolve(__dirname, "../../.env.test"), override: true, quiet: true })

function parseNumericArgument(argumentName: string): number | null {
  const matchingArgument = process.argv.find((argumentValue) =>
    argumentValue.startsWith(`${argumentName}=`),
  )
  if (!matchingArgument) {
    return null
  }

  const numericValue = Number(matchingArgument.split("=")[1])
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : null
}

function getCpuCount(): number {
  return cpus().length
}

function resolveWorkerCount(): number {
  const cliWorkers = parseNumericArgument("--workers")
  if (cliWorkers) {
    return cliWorkers
  }

  const envWorkers = Number(process.env.TEST_WORKERS)
  if (Number.isFinite(envWorkers) && envWorkers > 0) {
    return Math.floor(envWorkers)
  }

  const maxWorkersValue = process.env.TEST_MAX_WORKERS
  if (!maxWorkersValue) {
    return Math.max(1, Math.floor(getCpuCount() * 0.5))
  }

  if (maxWorkersValue.endsWith("%")) {
    const percentValue = Number(maxWorkersValue.slice(0, -1))
    if (Number.isFinite(percentValue) && percentValue > 0) {
      return Math.max(1, Math.floor((getCpuCount() * percentValue) / 100))
    }
  }

  const absoluteWorkersValue = Number(maxWorkersValue)
  if (Number.isFinite(absoluteWorkersValue) && absoluteWorkersValue > 0) {
    return Math.floor(absoluteWorkersValue)
  }

  return Math.max(1, Math.floor(getCpuCount() * 0.5))
}

function buildBaseDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const databaseHost = process.env.DATABASE_HOST
  const databasePort = process.env.DATABASE_PORT
  const databaseUsername = process.env.DATABASE_USERNAME
  const databasePassword = process.env.DATABASE_PASSWORD
  const databaseName = process.env.DATABASE_NAME

  if (!databaseHost || !databasePort || !databaseUsername || !databaseName) {
    throw new Error(
      "Missing DATABASE_URL and database components in environment. Please configure .env.test.",
    )
  }

  const encodedUsername = encodeURIComponent(databaseUsername)
  const encodedPassword = encodeURIComponent(databasePassword ?? "")
  const passwordSegment = databasePassword ? `:${encodedPassword}` : ""

  return `postgres://${encodedUsername}${passwordSegment}@${databaseHost}:${databasePort}/${databaseName}`
}

function getDatabaseNameFromUrl(databaseUrl: string): string {
  const parsedUrl = new URL(databaseUrl)
  const databaseName = parsedUrl.pathname.replace(/^\//, "")
  if (!databaseName) {
    throw new Error(`Invalid DATABASE_URL without database name: ${databaseUrl}`)
  }
  return databaseName
}

function buildWorkerDatabaseName(baseDatabaseName: string, workerIndex: number): string {
  return `${baseDatabaseName}_w${workerIndex}`
}

async function terminateDatabaseConnections(
  adminClient: Client,
  databaseName: string,
): Promise<void> {
  await adminClient.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1
       AND pid <> pg_backend_pid()`,
    [databaseName],
  )
}

async function main(): Promise<void> {
  const baseDatabaseUrl = buildBaseDatabaseUrl()
  const baseDatabaseName = getDatabaseNameFromUrl(baseDatabaseUrl)
  const workerCount = resolveWorkerCount()

  const adminConnectionString = process.env.TEST_ADMIN_DATABASE_URL

  const adminDatabaseUrl = new URL(adminConnectionString ?? baseDatabaseUrl)
  adminDatabaseUrl.pathname = "/postgres"

  const adminClient = new Client({ connectionString: adminDatabaseUrl.toString() })
  await adminClient.connect()

  try {
    console.log(
      `Preparing ${workerCount} worker databases by cloning "${baseDatabaseName}" into "${baseDatabaseName}_w{n}"...`,
    )

    // CREATE DATABASE ... TEMPLATE requires no active sessions on the source database.
    await terminateDatabaseConnections(adminClient, baseDatabaseName)

    for (let workerIndex = 1; workerIndex <= workerCount; workerIndex += 1) {
      const workerDatabaseName = buildWorkerDatabaseName(baseDatabaseName, workerIndex)
      await terminateDatabaseConnections(adminClient, workerDatabaseName)
      await adminClient.query(`DROP DATABASE IF EXISTS "${workerDatabaseName}"`)
      await adminClient.query(
        `CREATE DATABASE "${workerDatabaseName}" TEMPLATE "${baseDatabaseName}"`,
      )

      console.log(`Prepared database ${workerDatabaseName}`)
    }
  } finally {
    await adminClient.end()
  }
}

main().catch((error) => {
  console.error("Failed to prepare test worker databases:", error)
  process.exit(1)
})
