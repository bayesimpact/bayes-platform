import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { EntityManager } from "typeorm"
import { IsNull, type Repository } from "typeorm"
import {
  AGENT_ROLES,
  CAMPAIGN_ROLES,
  ORGANIZATION_ROLES,
  PROJECT_ROLES,
  type RbacRoleName,
} from "./rbac.constants"
import { Role } from "./role.entity"
import { UserRole } from "./user-role.entity"

/** Suffix shared by the legacy `OrganizationMembershipRole`, `ProjectMembershipRole`, `AgentMembershipRole`. */
export type ScopedMembershipRole = "owner" | "admin" | "member"

/**
 * Normalized projection of one `user_role` row, scope-filtered to its `conditions`.
 *
 * Phase 1 only exposes the role name + condition payload. Phase 3 will widen this
 * with the full `(action, subject)` permission rules once CASL adopts.
 */
export type UserGrant = {
  roleName: RbacRoleName
  conditions: Record<string, unknown> | null
}

export type GrantSummary = {
  id: string
  userId: string
  roleName: RbacRoleName
  conditions: Record<string, unknown>
}

export type RolePrefix = "org_" | "project_" | "agent_" | "campaign_"

/**
 * Read + write adapter against the unified `user_role` table.
 *
 * After Phase-4 Checkpoint C, all per-scope reads come from `user_role`. The
 * legacy membership tables (`organization_membership`, `project_membership`,
 * `agent_membership`, `review_campaign_membership`) are still the write source
 * of truth in production until Checkpoint G removes the legacy writes. Between
 * C and G, `LegacyMembershipMirrorSubscriber` shadows every legacy insert /
 * update / soft-remove into `user_role` so reads stay consistent.
 */
@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async loadUserGrants(userId: string): Promise<UserGrant[]> {
    const rows = await this.userRoleRepository
      .createQueryBuilder("user_role")
      .innerJoin(Role, "role", "role.id = user_role.role_id")
      .select(["role.name AS role_name", "user_role.conditions AS conditions"])
      .where("user_role.user_id = :userId", { userId })
      .andWhere("user_role.deleted_at IS NULL")
      .getRawMany<{ role_name: string; conditions: Record<string, unknown> | null }>()

    const grants: UserGrant[] = []
    for (const row of rows) {
      if (!isRbacRoleName(row.role_name)) continue
      grants.push({ roleName: row.role_name, conditions: row.conditions })
    }
    return grants
  }

  async organizationRole(
    userId: string,
    organizationId: string,
  ): Promise<ScopedMembershipRole | null> {
    return this.projectScopedRolePrefix(userId, "org_", (conditions) => {
      const orgId = conditions?.organizationId
      return typeof orgId === "string" && orgId === organizationId
    })
  }

  async projectRole(userId: string, projectId: string): Promise<ScopedMembershipRole | null> {
    return this.projectScopedRolePrefix(userId, "project_", (conditions) => {
      const id = conditions?.projectId
      return typeof id === "string" && id === projectId
    })
  }

  async agentRole(userId: string, agentId: string): Promise<ScopedMembershipRole | null> {
    return this.projectScopedRolePrefix(userId, "agent_", (conditions) => {
      const id = conditions?.agentId
      return typeof id === "string" && id === agentId
    })
  }

  async campaignRoles(
    userId: string,
    campaignId: string,
  ): Promise<{ tester: boolean; reviewer: boolean }> {
    // A user may hold tester AND reviewer roles on the same campaign — collect
    // both grants and project each role flag independently.
    const grants = await this.loadUserGrants(userId)
    let tester = false
    let reviewer = false
    for (const grant of grants) {
      const id = grant.conditions?.campaignId
      if (typeof id !== "string" || id !== campaignId) continue
      if (grant.roleName === "campaign_tester") tester = true
      if (grant.roleName === "campaign_reviewer") reviewer = true
    }
    return { tester, reviewer }
  }

  /**
   * Insert a `user_role` row for `(userId, roleName, conditions)`.
   *
   * Idempotent: if a non-deleted grant already exists for the same scope it is
   * returned untouched. Pair this with the `uq_user_role_scope` partial unique
   * index for hard concurrency safety.
   */
  async grantRole(params: {
    userId: string
    roleName: RbacRoleName
    conditions: Record<string, unknown>
    manager?: EntityManager
  }): Promise<UserRole> {
    const repo = this.userRoleRepo(params.manager)
    const roleId = await this.resolveRoleId(params.roleName, params.manager)
    const existing = await this.findGrantByScope(repo, params.userId, roleId, params.conditions)
    if (existing) return existing
    return repo.save(repo.create({ userId: params.userId, roleId, conditions: params.conditions }))
  }

  /**
   * Upsert/upgrade a grant. If the user holds any role in `fromRoles` with
   * matching scope, switch that row's `role_id` to `toRole`. Otherwise insert a
   * fresh `toRole` grant. No-ops (returns the existing row) if the user already
   * holds `toRole` at this scope.
   *
   * Used by invitation flows (e.g. member → admin upgrade) so the row's id /
   * timestamps survive the role change.
   */
  async upsertGrantRoleUpgrade(params: {
    userId: string
    conditions: Record<string, unknown>
    fromRoles: RbacRoleName[]
    toRole: RbacRoleName
    manager?: EntityManager
  }): Promise<UserRole> {
    const repo = this.userRoleRepo(params.manager)
    const toRoleId = await this.resolveRoleId(params.toRole, params.manager)

    const existingAtTarget = await this.findGrantByScope(
      repo,
      params.userId,
      toRoleId,
      params.conditions,
    )
    if (existingAtTarget) return existingAtTarget

    for (const fromRole of params.fromRoles) {
      const fromRoleId = await this.resolveRoleId(fromRole, params.manager)
      const existing = await this.findGrantByScope(
        repo,
        params.userId,
        fromRoleId,
        params.conditions,
      )
      if (existing) {
        existing.roleId = toRoleId
        return repo.save(existing)
      }
    }

    return repo.save(
      repo.create({ userId: params.userId, roleId: toRoleId, conditions: params.conditions }),
    )
  }

  /**
   * Soft-delete the grant matching `(userId, roleName, conditions)`. No-op if no
   * such grant exists.
   */
  async revokeGrant(params: {
    userId: string
    roleName: RbacRoleName
    conditions: Record<string, unknown>
    manager?: EntityManager
  }): Promise<void> {
    const repo = this.userRoleRepo(params.manager)
    const roleId = await this.resolveRoleId(params.roleName, params.manager)
    const existing = await this.findGrantByScope(repo, params.userId, roleId, params.conditions)
    if (!existing) return
    await repo.softRemove(existing)
  }

  /**
   * Return every active grant whose role name starts with `rolePrefix` and
   * whose `conditions` are a JSONB-superset of `params.conditions`.
   *
   * Phase-4 callers: `listProjectMemberships(projectId)` →
   * `{ rolePrefix: "project_", conditions: { projectId } }`.
   */
  async listGrantsByScope(params: {
    conditions: Record<string, unknown>
    rolePrefix: RolePrefix
    manager?: EntityManager
  }): Promise<GrantSummary[]> {
    const repo = this.userRoleRepo(params.manager)
    const rows = await repo
      .createQueryBuilder("user_role")
      .innerJoin(Role, "role", "role.id = user_role.role_id")
      .select([
        "user_role.id AS id",
        "user_role.user_id AS user_id",
        "user_role.conditions AS conditions",
        "role.name AS role_name",
      ])
      .where("role.name LIKE :prefix", { prefix: `${params.rolePrefix}%` })
      .andWhere("user_role.conditions @> :scope::jsonb", {
        scope: JSON.stringify(params.conditions),
      })
      .andWhere("user_role.deleted_at IS NULL")
      .getRawMany<{
        id: string
        user_id: string
        role_name: string
        conditions: Record<string, unknown> | null
      }>()

    const grants: GrantSummary[] = []
    for (const row of rows) {
      if (!isRbacRoleName(row.role_name)) continue
      grants.push({
        id: row.id,
        userId: row.user_id,
        roleName: row.role_name,
        conditions: row.conditions ?? {},
      })
    }
    return grants
  }

  async findGrantById(grantId: string, manager?: EntityManager): Promise<UserRole | null> {
    const repo = this.userRoleRepo(manager)
    return repo.findOne({
      where: { id: grantId, deletedAt: IsNull() },
      relations: ["role"],
    })
  }

  private userRoleRepo(manager?: EntityManager): Repository<UserRole> {
    return manager?.getRepository(UserRole) ?? this.userRoleRepository
  }

  private async resolveRoleId(roleName: RbacRoleName, manager?: EntityManager): Promise<string> {
    const repo = manager?.getRepository(Role) ?? this.roleRepository
    const role = await repo.findOne({ where: { name: roleName } })
    if (!role) {
      throw new Error(
        `Role "${roleName}" missing from catalog — has the seed-rbac-roles-and-backfill migration run?`,
      )
    }
    return role.id
  }

  private async findGrantByScope(
    repo: Repository<UserRole>,
    userId: string,
    roleId: string,
    conditions: Record<string, unknown>,
  ): Promise<UserRole | null> {
    // Containment-in-both-directions matches semantic equality regardless of key
    // ordering. Postgres normalises JSONB on storage, but `@>` survives
    // round-trips through any JS-side mutation of the conditions object.
    return repo
      .createQueryBuilder("user_role")
      .where("user_role.user_id = :userId", { userId })
      .andWhere("user_role.role_id = :roleId", { roleId })
      .andWhere("user_role.conditions @> :scope::jsonb AND :scope::jsonb @> user_role.conditions", {
        scope: JSON.stringify(conditions),
      })
      .andWhere("user_role.deleted_at IS NULL")
      .getOne()
  }

  private async projectScopedRolePrefix(
    userId: string,
    prefix: RolePrefix,
    scopeMatches: (conditions: Record<string, unknown> | null) => boolean,
  ): Promise<ScopedMembershipRole | null> {
    const grants = await this.loadUserGrants(userId)
    let best: ScopedMembershipRole | null = null
    for (const grant of grants) {
      if (!grant.roleName.startsWith(prefix)) continue
      if (!scopeMatches(grant.conditions)) continue
      const suffix = grant.roleName.slice(prefix.length) as ScopedMembershipRole
      if (suffix === "owner") return "owner"
      if (suffix === "admin") best = best === null ? "admin" : best
      if (suffix === "member" && best === null) best = "member"
    }
    return best
  }
}

function isRbacRoleName(value: string): value is RbacRoleName {
  return (
    (ORGANIZATION_ROLES as readonly string[]).includes(value) ||
    (PROJECT_ROLES as readonly string[]).includes(value) ||
    (AGENT_ROLES as readonly string[]).includes(value) ||
    (CAMPAIGN_ROLES as readonly string[]).includes(value)
  )
}
