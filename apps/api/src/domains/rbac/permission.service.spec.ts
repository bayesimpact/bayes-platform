import { In } from "typeorm"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  ORG_CREATOR_ROLE,
  ORGANIZATION_CREATE_PERMISSION,
  ORGANIZATION_ROLE_PERMISSIONS,
  ORGANIZATION_ROLES,
  PROJECT_READ_PERMISSION,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_ROLES,
} from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { RbacService } from "@/domains/rbac/rbac.service"
import { Role } from "@/domains/rbac/role.entity"
import { RolePermission } from "@/domains/rbac/role-permission.entity"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"

describe("PermissionService", () => {
  let service: PermissionService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    await ensureRbacCatalog(setup.module)
    service = setup.module.get(PermissionService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  it("lists a role's permissions from the catalog", async () => {
    const repositories = setup.getAllRepositories()
    const ownerRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORGANIZATION_ROLES.owner },
    })

    const permissions = await service.listPermissionsForRole(ownerRole.id)

    expect(permissions.length).toBe(ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.owner].length)
    expect(new Set(permissions)).toEqual(
      new Set(ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.owner]),
    )
  })

  it("grants organization.update to owners and admins", async () => {
    const repositories = setup.getAllRepositories()
    const { organization, user } = await createOrganizationWithOwner(repositories)

    await expect(
      service.has(user.id, "organization.update", {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(true)

    const adminUser = userFactory.build()
    await repositories.userRepository.save(adminUser)
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: adminUser.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "admin",
        roleId: (
          await repositories.roleRepository.findOneOrFail({
            where: { key: ORGANIZATION_ROLES.admin },
          })
        ).id,
      }),
    )

    await expect(
      service.has(adminUser.id, "organization.update", {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(true)
  })

  it("denies organization.update to members", async () => {
    const repositories = setup.getAllRepositories()
    const { organization } = await createOrganizationWithOwner(repositories)
    const memberUser = userFactory.build()
    await repositories.userRepository.save(memberUser)
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: memberUser.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "member",
        roleId: (
          await repositories.roleRepository.findOneOrFail({
            where: { key: ORGANIZATION_ROLES.member },
          })
        ).id,
      }),
    )

    await expect(
      service.has(memberUser.id, "organization.update", {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(false)
  })

  it("grants organization.create via global org_creator membership", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "creator@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const orgCreatorRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORG_CREATOR_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: orgCreatorRole.id,
      }),
    )

    await expect(service.hasGlobal(user.id, ORGANIZATION_CREATE_PERMISSION)).resolves.toBe(true)
  })

  it("denies organization.create without global org_creator membership", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "outsider@example.com" })
    await repositories.userRepository.save(user)

    await expect(service.hasGlobal(user.id, ORGANIZATION_CREATE_PERMISSION)).resolves.toBe(false)
  })

  it("lists global permissions for org_creator users", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "creator@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const orgCreatorRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORG_CREATOR_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: orgCreatorRole.id,
      }),
    )

    await expect(service.listGlobalPermissions(user.id)).resolves.toEqual([
      ORGANIZATION_CREATE_PERMISSION,
    ])
  })

  describe("listResourceIds", () => {
    it("lists resource ids the user can read through a direct membership", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await expect(service.listResourceIds(user.id, "organization")).resolves.toEqual([
        organization.id,
      ])
    })

    it("lists child resource ids inherited from a parent membership", async () => {
      const repositories = setup.getAllRepositories()
      // the org owner holds project.read on the organization, but no project membership
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      await expect(service.listResourceIds(user.id, "project")).resolves.toEqual([project.id])
    })

    it("ignores memberships whose role does not grant the read permission", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      // project membership without any RBAC role: no read permission, no access
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "member",
        }),
      )

      await expect(service.listResourceIds(projectUser.id, "project")).resolves.toEqual([])
    })

    it("returns an empty array when the user has no access", async () => {
      const repositories = setup.getAllRepositories()
      const user = userFactory.build()
      await repositories.userRepository.save(user)

      await expect(service.listResourceIds(user.id, "organization")).resolves.toEqual([])
    })
  })

  describe("listResourcePermissions", () => {
    it("inherits project permissions from the organization membership", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const permissionsByProjectId = await service.listResourcePermissions(user.id, "project")

      expect([...permissionsByProjectId.keys()]).toEqual([project.id])
      expect(permissionsByProjectId.get(project.id)?.sort()).toEqual(
        ["project.create", "project.read"].sort(),
      )
    })

    it("grants project.read via the catalog project_member role", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const projectMemberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.member },
      })
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "member",
          roleId: projectMemberRole.id,
        }),
      )

      const permissionsByProjectId = await service.listResourcePermissions(
        projectUser.id,
        "project",
      )

      expect(permissionsByProjectId.get(project.id)).toEqual([PROJECT_READ_PERMISSION])
    })

    it("merges direct project permissions with inherited organization permissions", async () => {
      const repositories = setup.getAllRepositories()
      // org owner: inherits project.create + project.read on every project of the org
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      // direct project owner: project.update, project.delete, agent.* on this project
      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: user.id,
          resourceType: "project",
          resourceId: project.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      const permissionsByProjectId = await service.listResourcePermissions(user.id, "project")

      expect(permissionsByProjectId.get(project.id)?.sort()).toEqual(
        [...new Set([...PROJECT_ROLE_PERMISSIONS.project_owner, "project.create"])].sort(),
      )
    })

    it("returns permissions from a role held directly on the project", async () => {
      const repositories = setup.getAllRepositories()
      // roles are not wiped by clearTestDatabase: remove any leftover ad-hoc role
      // (from a previous run) so the insert below and the RbacService seed test stay green
      await repositories.roleRepository.delete({ key: "test_project_reader" })

      try {
        const { organization } = await createOrganizationWithOwner(repositories)
        const project = projectFactory.transient({ organization }).build()
        await repositories.projectRepository.save(project)

        const projectRole = await repositories.roleRepository.save(
          repositories.roleRepository.create({
            key: "test_project_reader",
            name: "Test Project Reader",
            scopeType: "project",
          }),
        )
        await setup.dataSource.query(
          `INSERT INTO role_permission (role_id, permission_key) VALUES ($1, $2)`,
          [projectRole.id, PROJECT_READ_PERMISSION],
        )

        const projectUser = userFactory.build()
        await repositories.userRepository.save(projectUser)
        await repositories.userMembershipRepository.save(
          userMembershipFactory.build({
            userId: projectUser.id,
            resourceType: "project",
            resourceId: project.id,
            role: "member",
            roleId: projectRole.id,
          }),
        )

        const permissionsByProjectId = await service.listResourcePermissions(
          projectUser.id,
          "project",
        )

        expect(permissionsByProjectId.get(project.id)).toEqual([PROJECT_READ_PERMISSION])
      } finally {
        const testRole = await repositories.roleRepository.findOne({
          where: { key: "test_project_reader" },
        })
        if (testRole) {
          await repositories.userMembershipRepository.delete({ roleId: testRole.id })
          await repositories.roleRepository.delete({ id: testRole.id })
        }
      }
    })

    it("returns an empty map when the user has no access", async () => {
      const repositories = setup.getAllRepositories()
      const user = userFactory.build()
      await repositories.userRepository.save(user)

      const permissionsByProjectId = await service.listResourcePermissions(user.id, "project")

      expect(permissionsByProjectId.size).toBe(0)
    })
  })
})

describe("RbacService", () => {
  let service: RbacService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "@bayesimpact.org"
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    service = setup.module.get(RbacService)
    await service.seedOrganizationRolesAndPermissions()
  })

  afterAll(async () => {
    delete process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "@bayesimpact.org"
    await clearTestDatabase(setup.dataSource)
  })

  it("seeds org roles and permissions idempotently", async () => {
    await service.seedOrganizationRolesAndPermissions()

    const orgRoleKeys = [...Object.values(ORGANIZATION_ROLES), ORG_CREATOR_ROLE]
    const roles = await setup.getRepository(Role).find({ where: { key: In(orgRoleKeys) } })
    expect(roles.map((role) => role.key).sort()).toEqual([...orgRoleKeys].sort())

    const rolePermissions = await setup.getRepository(RolePermission).find({
      where: { roleId: In(roles.map((role) => role.id)) },
    })
    const expectedLinks = Object.values(ORGANIZATION_ROLE_PERMISSIONS).flatMap((keys) => [...keys])
    expect(rolePermissions).toHaveLength(expectedLinks.length)
    expect([...new Set(rolePermissions.map((row) => row.permissionKey))].sort()).toEqual(
      [...new Set(expectedLinks)].sort(),
    )
  })

  it("seeds project roles and permissions idempotently", async () => {
    await service.seedProjectRolesAndPermissions()
    await service.seedProjectRolesAndPermissions()

    const projectRoleKeys = Object.values(PROJECT_ROLES)
    const roles = await setup.getRepository(Role).find({ where: { key: In(projectRoleKeys) } })
    expect(roles.map((role) => role.key).sort()).toEqual([...projectRoleKeys].sort())
    expect(roles.every((role) => role.scopeType === "project")).toBe(true)

    const rolePermissions = await setup.getRepository(RolePermission).find({
      where: { roleId: In(roles.map((role) => role.id)) },
    })
    const expectedLinks = Object.values(PROJECT_ROLE_PERMISSIONS).flatMap((keys) => [...keys])
    expect(rolePermissions).toHaveLength(expectedLinks.length)
    expect([...new Set(rolePermissions.map((row) => row.permissionKey))].sort()).toEqual(
      [...new Set(expectedLinks)].sort(),
    )
  })

  it("assigns role_id on organization memberships", async () => {
    const repositories = setup.getAllRepositories()
    const { user, organization } = await createOrganizationWithOwner(repositories)

    await service.assignRoleIdsToOrganizationMemberships()

    const membership = await setup.getRepository(UserMembership).findOneOrFail({
      where: { userId: user.id, resourceId: organization.id, resourceType: "organization" },
    })
    const orgOwnerRole = await setup.getRepository(Role).findOneOrFail({
      where: { key: ORGANIZATION_ROLES.owner },
    })
    expect(membership.roleId).toBe(orgOwnerRole.id)
  })

  it("assigns role_id on project memberships", async () => {
    await service.seedProjectRolesAndPermissions()
    const repositories = setup.getAllRepositories()
    const { organization } = await createOrganizationWithOwner(repositories)
    const project = projectFactory.transient({ organization }).build()
    await repositories.projectRepository.save(project)

    const projectUser = userFactory.build()
    await repositories.userRepository.save(projectUser)
    // legacy membership without role_id, as written before the RBAC catalog existed
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: projectUser.id,
        resourceType: "project",
        resourceId: project.id,
        role: "member",
        roleId: null,
      }),
    )

    await service.assignRoleIdsToProjectMemberships()

    const membership = await setup.getRepository(UserMembership).findOneOrFail({
      where: { userId: projectUser.id, resourceId: project.id, resourceType: "project" },
    })
    const projectMemberRole = await setup.getRepository(Role).findOneOrFail({
      where: { key: PROJECT_ROLES.member },
    })
    expect(membership.roleId).toBe(projectMemberRole.id)
  })

  it("assigns org_creator to eligible users", async () => {
    const repositories = setup.getAllRepositories()
    const eligibleUser = userFactory.build({ email: "member@bayesimpact.org" })
    const ineligibleUser = userFactory.build({ email: "member@example.com" })
    await repositories.userRepository.save([eligibleUser, ineligibleUser])

    const assignedCount = await service.assignOrgCreatorToEligibleUsers()
    expect(assignedCount).toBe(1)

    const orgCreatorRole = await setup.getRepository(Role).findOneOrFail({
      where: { key: ORG_CREATOR_ROLE },
    })
    const eligibleMembership = await setup.getRepository(UserMembership).findOne({
      where: {
        userId: eligibleUser.id,
        resourceType: "global",
        roleId: orgCreatorRole.id,
      },
    })
    const ineligibleMembership = await setup.getRepository(UserMembership).findOne({
      where: {
        userId: ineligibleUser.id,
        resourceType: "global",
        roleId: orgCreatorRole.id,
      },
    })

    expect(eligibleMembership).not.toBeNull()
    expect(eligibleMembership?.resourceId).toBeNull()
    expect(ineligibleMembership).toBeNull()
  })
})
