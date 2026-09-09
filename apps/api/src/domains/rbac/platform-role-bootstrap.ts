import { PLATFORM_STAFF_ROLE, PLATFORM_SUPERADMIN_ROLE } from "./rbac.constants"

export type PlatformRoleKey = typeof PLATFORM_STAFF_ROLE | typeof PLATFORM_SUPERADMIN_ROLE

export const PLATFORM_ROLE_KEYS: readonly PlatformRoleKey[] = [
  PLATFORM_SUPERADMIN_ROLE,
  PLATFORM_STAFF_ROLE,
]

export function isPlatformRoleKey(value: string): value is PlatformRoleKey {
  return (PLATFORM_ROLE_KEYS as readonly string[]).includes(value)
}

/**
 * The global roles the configuration promises to an email:
 *
 * - BACKOFFICE_AUTHORIZED_EMAILS (comma separated): platform_superadmin.
 * - ORGANIZATION_CREATOR_EMAIL_DOMAIN (for example "@example.org"): platform_staff.
 *
 * Pure: the same rules as the seed migrations, applied at every sign-in so a
 * fresh install and a new staff member get their roles without a migration.
 */
export function resolveBootstrapRoles(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): PlatformRoleKey[] {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return []

  const roles: PlatformRoleKey[] = []

  const superadminEmails = (env.BACKOFFICE_AUTHORIZED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
  if (superadminEmails.includes(normalizedEmail)) roles.push(PLATFORM_SUPERADMIN_ROLE)

  const staffDomain = env.ORGANIZATION_CREATOR_EMAIL_DOMAIN?.trim().toLowerCase()
  if (staffDomain && normalizedEmail.endsWith(staffDomain)) roles.push(PLATFORM_STAFF_ROLE)

  return roles
}
