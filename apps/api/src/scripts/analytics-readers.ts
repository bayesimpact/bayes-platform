/**
 * Grant the analytics schema to database roles: membership of
 * `analytics_reader` (docs/analytics-schema.md) and a statement timeout.
 *
 *   analytics-readers --role grafana_ro [--role other_ro] [--statement-timeout 30s]
 *
 * From the sources: `npm run analytics-readers -- --role grafana_ro`
 * From the runtime image (the chart's analyticsReaders job, after the
 * migrations):
 *   node /app/apps/api/dist/scripts/analytics-readers.js --role grafana_ro
 *
 * The role must exist: it belongs to the infrastructure (a dashboard tool's
 * login), not to the platform. GRANT is idempotent. Grant only: a role
 * removed from the list keeps its membership, revocation is a SQL command.
 *
 * The statement timeout is best effort: since Postgres 16, ALTER ROLE needs
 * the ADMIN OPTION on the target role, which the platform user has only on
 * roles it created itself. When it is refused, the script logs the statement
 * for an administrator and still succeeds: the membership is what the
 * dashboards need, the timeout is a guard.
 */
import { Logger } from "@nestjs/common"
import { connectionSource } from "@/config/typeorm"
import { ANALYTICS_READER_ROLE } from "./analytics-schema.constants"

const logger = new Logger("AnalyticsReaders")

/** A plain Postgres identifier: what a role name written in Helm values may be. */
const ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/
/** A Postgres duration with a unit: 30s, 500ms, 2min. */
const STATEMENT_TIMEOUT = /^[0-9]{1,6}(ms|s|min)$/

export type AnalyticsReadersOptions = { roles: string[]; statementTimeout: string }

export function parseCliOptions(argv: string[]): AnalyticsReadersOptions {
  const roles: string[] = []
  let statementTimeout = "30s"
  for (let index = 0; index < argv.length; index += 2) {
    const optionName = argv[index]
    const optionValue = argv[index + 1]
    if (optionValue === undefined) throw new Error(`Missing value for ${optionName}`)
    if (optionName === "--role") roles.push(optionValue)
    else if (optionName === "--statement-timeout") statementTimeout = optionValue
    else throw new Error(`Unknown option: ${optionName}`)
  }
  if (roles.length === 0) throw new Error("At least one --role <name> is required")
  for (const role of roles) {
    if (!ROLE_NAME.test(role)) throw new Error(`Not a role name: ${role}`)
  }
  if (!STATEMENT_TIMEOUT.test(statementTimeout)) {
    throw new Error(`Not a statement timeout (30s, 500ms, 2min): ${statementTimeout}`)
  }
  return { roles, statementTimeout }
}

/** The statements for one role. Identifiers and the duration are validated by parseCliOptions. */
export function grantStatements(
  role: string,
  statementTimeout: string,
): { grant: string; timeout: string } {
  return {
    grant: `GRANT ${ANALYTICS_READER_ROLE} TO "${role}"`,
    timeout: `ALTER ROLE "${role}" SET statement_timeout = '${statementTimeout}'`,
  }
}

/** SQLSTATE of "permission denied", on the TypeORM error and on the driver's. */
const INSUFFICIENT_PRIVILEGE = "42501"

function isInsufficientPrivilege(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === INSUFFICIENT_PRIVILEGE
  )
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  await connectionSource.initialize()
  try {
    const readerRole = await connectionSource.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [
      ANALYTICS_READER_ROLE,
    ])
    if (readerRole.length === 0) {
      throw new Error(`Role ${ANALYTICS_READER_ROLE} does not exist: run the migrations first`)
    }
    for (const role of options.roles) {
      const statements = grantStatements(role, options.statementTimeout)
      await connectionSource.query(statements.grant)
      logger.log(`${role}: member of ${ANALYTICS_READER_ROLE}`)
      try {
        await connectionSource.query(statements.timeout)
        logger.log(`${role}: statement_timeout ${options.statementTimeout}`)
      } catch (error) {
        if (!isInsufficientPrivilege(error)) throw error
        logger.warn(
          `${role}: no ADMIN OPTION on this role, the timeout is not set. As an administrator: ${statements.timeout};`,
        )
      }
    }
  } finally {
    await connectionSource.destroy()
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
