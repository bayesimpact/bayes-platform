/**
 * Grant, revoke or list the global platform roles of a user, by email.
 *
 *   platform-role grant  --email admin@example.org --role platform_superadmin
 *   platform-role revoke --email admin@example.org --role platform_staff
 *   platform-role list   --email admin@example.org
 *
 * From the sources: `npm run platform-role -- grant --email ... --role ...`
 * From the runtime image (Kubernetes exec, Cloud Run Job):
 *   node /app/apps/api/dist/scripts/platform-role.js grant --email ... --role ...
 *
 * `grant` works before the person has ever signed in: the user is created
 * with a placeholder identity and linked to the real one at first sign-in
 * (the same path as an invited member). This is how the first administrator
 * of a fresh install gets in. Roles are never granted automatically at
 * sign-in: an operator decides, here or in the chart's platformSuperadmins job.
 */
import { randomUUID } from "node:crypto"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "@/app.module"
import { PLACEHOLDER_AUTH0_ID_PREFIX } from "@/domains/projects/memberships/project-memberships.service"
import {
  isPlatformRoleKey,
  PLATFORM_ROLE_KEYS,
  PlatformRoleService,
} from "@/domains/rbac/platform-role.service"
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
  const email = options.get("email")?.trim().toLowerCase()
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
    const platformRoles = app.get(PlatformRoleService)

    let user = await usersService.findByEmail(email)

    if (command === "list") {
      if (!user) {
        logger.log(`${email}: no user yet`)
        return
      }
      const roles = await platformRoles.listGlobalRoles(user.id)
      logger.log(`${email}: ${roles.length > 0 ? roles.join(", ") : "no global role"}`)
      return
    }

    if (role === null || !isPlatformRoleKey(role)) usage("--role is required")

    if (command === "revoke") {
      if (!user) {
        logger.log(`${email}: no user, nothing to revoke`)
        return
      }
      const revoked = await platformRoles.revokeGlobalRole(user.id, role)
      logger.log(revoked ? `Revoked ${role} from ${email}` : `${email} did not have ${role}`)
      return
    }

    if (!user) {
      // Pre-provision: linked to the identity provider account at first sign-in.
      user = await usersService.create({
        sub: `${PLACEHOLDER_AUTH0_ID_PREFIX}${randomUUID().slice(-12)}`,
        email,
      })
      logger.log(`Created ${email} (signs in for the first time later)`)
    }
    const created = await platformRoles.grantGlobalRole(user.id, role)
    logger.log(created ? `Granted ${role} to ${email}` : `${email} already has ${role}`)
  } finally {
    await app.close()
  }
}

void main()
