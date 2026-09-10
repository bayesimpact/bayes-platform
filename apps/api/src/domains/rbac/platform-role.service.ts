import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { type PlatformRoleKey, PlatformRoleRepository } from "./platform-role.repository"
import { PLATFORM_STAFF_ROLE, PLATFORM_SUPERADMIN_ROLE } from "./rbac.constants"

export type { PlatformRoleKey } from "./platform-role.repository"

export const PLATFORM_ROLE_KEYS: readonly PlatformRoleKey[] = [
  PLATFORM_SUPERADMIN_ROLE,
  PLATFORM_STAFF_ROLE,
]

export function isPlatformRoleKey(value: string): value is PlatformRoleKey {
  return (PLATFORM_ROLE_KEYS as readonly string[]).includes(value)
}

/**
 * Grants and revokes the global roles (platform_superadmin, platform_staff).
 *
 * Deliberately not called at sign-in: granting a global role from the email
 * the identity provider reports would let anyone who can register an address
 * of the right shape become staff. Roles are granted by an operator, through
 * the platform-role command (scripts/platform-role.ts), the chart's
 * platformSuperadmins job, or later the back office.
 */
@Injectable()
export class PlatformRoleService {
  constructor(private readonly platformRoleRepository: PlatformRoleRepository) {}

  /** Returns true when the role was granted, false when the user already had it. */
  grantGlobalRole(userId: string, roleKey: PlatformRoleKey): Promise<boolean> {
    return this.platformRoleRepository.grantGlobalRole(userId, roleKey)
  }

  /** Returns true when the role was revoked, false when the user did not have it. */
  revokeGlobalRole(userId: string, roleKey: PlatformRoleKey): Promise<boolean> {
    return this.platformRoleRepository.revokeGlobalRole(userId, roleKey)
  }

  listGlobalRoles(userId: string): Promise<string[]> {
    return this.platformRoleRepository.listGlobalRoleKeys(userId)
  }
}
