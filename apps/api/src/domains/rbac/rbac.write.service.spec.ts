import { randomUUID } from "node:crypto"
import { IsNull, type Repository } from "typeorm"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { RbacService } from "./rbac.service"
import { Role } from "./role.entity"
import { UserRole } from "./user-role.entity"

describe("RbacService write methods", () => {
  let service: RbacService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let userRoleRepo: Repository<UserRole>
  let roleRepo: Repository<Role>
  let userRepo: Repository<User>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ providers: [RbacService] })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<RbacService>(RbacService)
    userRoleRepo = setup.getRepository(UserRole)
    roleRepo = setup.getRepository(Role)
    userRepo = setup.getAllRepositories().userRepository
  })

  const createUser = async () => userRepo.save(userFactory.build())

  describe("grantRole", () => {
    it("inserts a user_role row", async () => {
      const user = await createUser()
      const organizationId = randomUUID()

      const grant = await service.grantRole({
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId },
      })

      expect(grant.id).toBeDefined()
      expect(grant.userId).toBe(user.id)
      expect(grant.conditions).toEqual({ organizationId })

      const stored = await userRoleRepo.findOne({ where: { id: grant.id } })
      expect(stored).not.toBeNull()
    })

    it("is idempotent: re-granting the same scope returns the existing row", async () => {
      const user = await createUser()
      const organizationId = randomUUID()

      const first = await service.grantRole({
        userId: user.id,
        roleName: "org_admin",
        conditions: { organizationId },
      })
      const second = await service.grantRole({
        userId: user.id,
        roleName: "org_admin",
        conditions: { organizationId },
      })

      expect(second.id).toBe(first.id)
      const count = await userRoleRepo.count({
        where: { userId: user.id, deletedAt: IsNull() },
      })
      expect(count).toBe(1)
    })

    it("treats different conditions as distinct grants", async () => {
      const user = await createUser()

      await service.grantRole({
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId: randomUUID() },
      })
      await service.grantRole({
        userId: user.id,
        roleName: "org_owner",
        conditions: { organizationId: randomUUID() },
      })

      const count = await userRoleRepo.count({
        where: { userId: user.id, deletedAt: IsNull() },
      })
      expect(count).toBe(2)
    })

    it("matches semantically-equivalent conditions regardless of key order", async () => {
      const user = await createUser()
      const organizationId = randomUUID()
      const projectId = randomUUID()

      const first = await service.grantRole({
        userId: user.id,
        roleName: "project_admin",
        conditions: { organizationId, projectId },
      })
      const second = await service.grantRole({
        userId: user.id,
        roleName: "project_admin",
        conditions: { projectId, organizationId },
      })

      expect(second.id).toBe(first.id)
    })
  })

  describe("upsertGrantRoleUpgrade", () => {
    it("upgrades an existing fromRole grant in place (preserves id)", async () => {
      const user = await createUser()
      const organizationId = randomUUID()

      const memberGrant = await service.grantRole({
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId },
      })

      const upgraded = await service.upsertGrantRoleUpgrade({
        userId: user.id,
        conditions: { organizationId },
        fromRoles: ["org_member"],
        toRole: "org_admin",
      })

      expect(upgraded.id).toBe(memberGrant.id)
      const admin = await roleRepo.findOneByOrFail({ name: "org_admin" })
      expect(upgraded.roleId).toBe(admin.id)
    })

    it("inserts a fresh grant when no fromRole match exists", async () => {
      const user = await createUser()
      const organizationId = randomUUID()

      const grant = await service.upsertGrantRoleUpgrade({
        userId: user.id,
        conditions: { organizationId },
        fromRoles: ["org_member"],
        toRole: "org_admin",
      })

      expect(grant.id).toBeDefined()
      const admin = await roleRepo.findOneByOrFail({ name: "org_admin" })
      expect(grant.roleId).toBe(admin.id)
    })

    it("returns the existing toRole grant unchanged when already at target", async () => {
      const user = await createUser()
      const organizationId = randomUUID()

      const adminGrant = await service.grantRole({
        userId: user.id,
        roleName: "org_admin",
        conditions: { organizationId },
      })

      const result = await service.upsertGrantRoleUpgrade({
        userId: user.id,
        conditions: { organizationId },
        fromRoles: ["org_member"],
        toRole: "org_admin",
      })

      expect(result.id).toBe(adminGrant.id)
    })
  })

  describe("revokeGrant", () => {
    it("soft-deletes the matching grant", async () => {
      const user = await createUser()
      const organizationId = randomUUID()

      const grant = await service.grantRole({
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId },
      })

      await service.revokeGrant({
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId },
      })

      const live = await userRoleRepo.findOne({
        where: { id: grant.id, deletedAt: IsNull() },
      })
      expect(live).toBeNull()
      const withDeleted = await userRoleRepo.findOne({
        where: { id: grant.id },
        withDeleted: true,
      })
      expect(withDeleted?.deletedAt).not.toBeNull()
    })

    it("allows re-granting the same scope after revoke", async () => {
      const user = await createUser()
      const organizationId = randomUUID()

      await service.grantRole({
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId },
      })
      await service.revokeGrant({
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId },
      })
      const reGrant = await service.grantRole({
        userId: user.id,
        roleName: "org_member",
        conditions: { organizationId },
      })

      expect(reGrant.id).toBeDefined()
      const live = await userRoleRepo.count({
        where: { userId: user.id, deletedAt: IsNull() },
      })
      expect(live).toBe(1)
    })

    it("is a no-op when no grant matches", async () => {
      const user = await createUser()
      await expect(
        service.revokeGrant({
          userId: user.id,
          roleName: "org_admin",
          conditions: { organizationId: randomUUID() },
        }),
      ).resolves.toBeUndefined()
    })
  })

  describe("listGrantsByScope", () => {
    it("returns grants whose role matches the prefix and whose conditions are a superset of the scope filter", async () => {
      const userA = await createUser()
      const userB = await createUser()
      const projectId = randomUUID()
      const organizationId = randomUUID()

      await service.grantRole({
        userId: userA.id,
        roleName: "project_owner",
        conditions: { organizationId, projectId },
      })
      await service.grantRole({
        userId: userB.id,
        roleName: "project_member",
        conditions: { organizationId, projectId },
      })
      // Different project — should be filtered out.
      await service.grantRole({
        userId: userA.id,
        roleName: "project_admin",
        conditions: { organizationId, projectId: randomUUID() },
      })
      // Org-level grant — wrong prefix, should be filtered out.
      await service.grantRole({
        userId: userA.id,
        roleName: "org_admin",
        conditions: { organizationId },
      })

      const grants = await service.listGrantsByScope({
        conditions: { projectId },
        rolePrefix: "project_",
      })

      expect(grants.map((grant) => grant.roleName).sort()).toEqual([
        "project_member",
        "project_owner",
      ])
    })

    it("excludes soft-deleted grants", async () => {
      const user = await createUser()
      const projectId = randomUUID()
      const organizationId = randomUUID()
      await service.grantRole({
        userId: user.id,
        roleName: "project_member",
        conditions: { organizationId, projectId },
      })
      await service.revokeGrant({
        userId: user.id,
        roleName: "project_member",
        conditions: { organizationId, projectId },
      })

      const grants = await service.listGrantsByScope({
        conditions: { projectId },
        rolePrefix: "project_",
      })
      expect(grants).toHaveLength(0)
    })
  })

  describe("findGrantById", () => {
    it("returns the grant with its role relation loaded", async () => {
      const user = await createUser()
      const grant = await service.grantRole({
        userId: user.id,
        roleName: "agent_member",
        conditions: {
          organizationId: randomUUID(),
          projectId: randomUUID(),
          agentId: randomUUID(),
        },
      })

      const found = await service.findGrantById(grant.id)
      expect(found?.id).toBe(grant.id)
      expect(found?.role.name).toBe("agent_member")
    })

    it("returns null for soft-deleted grants", async () => {
      const user = await createUser()
      const grant = await service.grantRole({
        userId: user.id,
        roleName: "agent_member",
        conditions: { agentId: randomUUID() },
      })
      await userRoleRepo.softRemove(grant)

      expect(await service.findGrantById(grant.id)).toBeNull()
    })

    it("returns null for unknown ids", async () => {
      expect(await service.findGrantById(randomUUID())).toBeNull()
    })
  })
})
