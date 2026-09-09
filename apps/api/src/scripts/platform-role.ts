/**
 * Grant, revoke or list the global platform roles of a user.
 *
 *   platform-role grant  --email admin@example.org --role platform_superadmin
 *   platform-role revoke --email admin@example.org --role platform_staff
 *   platform-role list   --email admin@example.org
 *
 * From the sources: `npm run platform-role -- grant --email ... --role ...`
 * From the runtime image (Kubernetes, Cloud Run Job):
 *   node /app/apps/api/dist/scripts/platform-role.js grant --email ... --role ...
 *
 * The user must have signed in once (it is created at first sign-in). For
 * the first administrator of a fresh install, prefer BACKOFFICE_AUTHORIZED_EMAILS
 * in the configuration: the role is granted at sign-in without this command.
 */
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "@/app.module"
import { isPlatformRoleKey, PLATFORM_ROLE_KEYS } from "@/domains/rbac/platform-role-bootstrap"
import { PlatformRoleBootstrapService } from "@/domains/rbac/platform-role-bootstrap.service"
import { UsersService } from "@/domains/users/users.service"

const logger = new Logger("PlatformRole")

type Command = "grant" | "revoke" | "list"

function usage(message?: string): never {
  if (message) logger.error(message)
  logger.log(
    `Usage: platform-role <grant|revoke> --email <email> --role <${PLATFORM_ROLE_KEYS.join("|")}>\n` +
      "       platform-role list --email <email>",
  )
  process.exit(2)
}

function readArguments(argv: string[]): { command: Command; email: string; role: string | null } {
  const [command, ...rest] = argv
  if (command !== "grant" && command !== "revoke" && command !== "list") usage()
  const options = new Map<string, string>()
  for (let index = 0; index < rest.length; index += 2) {
    const optionName = rest[index]
    const optionValue = rest[index + 1]
    if (!optionName?.startsWith("--") || optionValue === undefined)
      usage(`Bad option: ${optionName}`)
    options.set(optionName.slice(2), optionValue)
  }
  const email = options.get("email")
  if (!email) usage("--email is required")
  const role = options.get("role") ?? null
  if (command !== "list" && !role) usage("--role is required")
  return { command, email, role }
}

async function main(): Promise<void> {
  const { command, email, role } = readArguments(process.argv.slice(2))
  if (role !== null && !isPlatformRoleKey(role)) {
    usage(`Unknown role ${role}. Expected one of ${PLATFORM_ROLE_KEYS.join(", ")}`)
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })
  try {
    const usersService = app.get(UsersService)
    const platformRoles = app.get(PlatformRoleBootstrapService)

    const user = await usersService.findByEmail(email)
    if (!user) {
      logger.error(`No user with email ${email}. The user must sign in once first.`)
      process.exitCode = 1
      return
    }

    if (command === "list") {
      const roles = await platformRoles.listGlobalRoles(user.id)
      logger.log(`${email}: ${roles.length > 0 ? roles.join(", ") : "no global role"}`)
      return
    }

    if (role === null || !isPlatformRoleKey(role)) usage("--role is required")

    if (command === "grant") {
      const created = await platformRoles.grantGlobalRole(user.id, role)
      logger.log(created ? `Granted ${role} to ${email}` : `${email} already has ${role}`)
    } else {
      const revoked = await platformRoles.revokeGlobalRole(user.id, role)
      logger.log(revoked ? `Revoked ${role} from ${email}` : `${email} did not have ${role}`)
    }
  } finally {
    await app.close()
  }
}

void main()
