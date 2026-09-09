import { randomUUID } from "node:crypto"
import { In } from "typeorm"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  AGENT_ROLE_PERMISSIONS,
  AGENT_ROLES,
  BACKOFFICE_AGENT_READ_PERMISSION,
  BACKOFFICE_ORGANIZATION_READ_PERMISSION,
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_PROJECT_UPDATE_PERMISSION,
  BACKOFFICE_READ_PERMISSION,
  BACKOFFICE_TERMS_UPDATE_PERMISSION,
  BACKOFFICE_USER_READ_PERMISSION,
  CATALOG_ROLE_KEYS,
  ORGANIZATION_CREATE_PERMISSION,
  ORGANIZATION_ROLE_PERMISSIONS,
  ORGANIZATION_ROLES,
  PERMISSION_DESCRIPTIONS,
  PLATFORM_STAFF_ROLE,
  PLATFORM_SUPERADMIN_ROLE,
  PROJECT_CREATE_PERMISSION,
  PROJECT_READ_PERMISSION,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_ROLES,
  TRACE_READ_PERMISSION,
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

  /**
   * Ad-hoc org-scoped role granting the given permissions. Catalog org roles no
   * longer grant any project permission, so tests of the parent -> child
   * inheritance machinery need a dedicated role. Roles are not wiped by
   * clearTestDatabase: any leftover role with the same key is recreated.
   */
  const recreateOrgRole = async (key: string, permissionKeys: string[]): Promise<Role> => {
    const repositories = setup.getAllRepositories()
    const leftoverRole = await repositories.roleRepository.findOne({ where: { key } })
    if (leftoverRole) {
      await repositories.userMembershipRepository.delete({ roleId: leftoverRole.id })
      await repositories.roleRepository.delete({ id: leftoverRole.id })
    }

    const role = await repositories.roleRepository.save(
      repositories.roleRepository.create({ key, name: key, scopeType: "organization" }),
    )
    for (const permissionKey of permissionKeys) {
      await setup.dataSource.query(
        `INSERT INTO role_permission (role_id, permission_key) VALUES ($1, $2)`,
        [role.id, permissionKey],
      )
    }
    return role
  }

  const addOrgMembershipWithRole = async (userId: string, organizationId: string, role: Role) => {
    const repositories = setup.getAllRepositories()
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId,
        resourceType: "organization",
        resourceId: organizationId,
        role: "member",
        roleId: role.id,
      }),
    )
  }

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

  it("lists global roles held by a user with their permission keys", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build()
    await repositories.userRepository.save(user)
    const superadminRole = await repositories.roleRepository.findOneOrFail({
      where: { key: PLATFORM_SUPERADMIN_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: superadminRole.id,
      }),
    )

    const globalRoles = await service.listGlobalRolesForUser(user.id)

    expect(globalRoles).toHaveLength(1)
    expect(globalRoles[0]?.key).toBe(PLATFORM_SUPERADMIN_ROLE)
    expect(new Set(globalRoles[0]?.permissions)).toEqual(
      new Set(ORGANIZATION_ROLE_PERMISSIONS[PLATFORM_SUPERADMIN_ROLE]),
    )
  })

  it("returns no global roles for a user without a platform membership", async () => {
    const repositories = setup.getAllRepositories()
    const { user } = await createOrganizationWithOwner(repositories)

    await expect(service.listGlobalRolesForUser(user.id)).resolves.toEqual([])
  })

  it("lists catalog grants for the given role ids", async () => {
    const repositories = setup.getAllRepositories()
    const ownerRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORGANIZATION_ROLES.owner },
    })
    const memberRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORGANIZATION_ROLES.member },
    })

    const grants = await service.listRoleGrants([ownerRole.id, memberRole.id])

    expect(grants.get(ownerRole.id)?.key).toBe(ORGANIZATION_ROLES.owner)
    expect(new Set(grants.get(ownerRole.id)?.permissions)).toEqual(
      new Set(ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.owner]),
    )
    expect(grants.get(memberRole.id)?.key).toBe(ORGANIZATION_ROLES.member)
    expect(new Set(grants.get(memberRole.id)?.permissions)).toEqual(
      new Set(ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.member]),
    )
  })

  it("returns an empty map when listing grants for no role ids", async () => {
    await expect(service.listRoleGrants([])).resolves.toEqual(new Map())
  })

  it("returns the official catalog roles in display order", async () => {
    const catalog = await service.getCatalog()

    expect(catalog.roles.map((role) => role.key)).toEqual([...CATALOG_ROLE_KEYS])
    const owner = catalog.roles.find((role) => role.key === ORGANIZATION_ROLES.owner)
    expect(owner?.scopeType).toBe("organization")
    expect(new Set(owner?.permissions)).toEqual(
      new Set(ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.owner]),
    )
    expect(catalog.permissions.map((permission) => permission.key)).toEqual(
      expect.arrayContaining(Object.keys(PERMISSION_DESCRIPTIONS)),
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

  it("grants backoffice.organization.read everywhere when held globally", async () => {
    const repositories = setup.getAllRepositories()
    const { organization } = await createOrganizationWithOwner(repositories)

    const superadmin = userFactory.build({ email: "superadmin@bayesimpact.org" })
    await repositories.userRepository.save(superadmin)
    const platformSuperadminRole = await repositories.roleRepository.findOneOrFail({
      where: { key: PLATFORM_SUPERADMIN_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: superadmin.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: platformSuperadminRole.id,
      }),
    )

    await expect(
      service.has(superadmin.id, BACKOFFICE_ORGANIZATION_READ_PERMISSION, {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(true)
  })

  it("grants backoffice.organization.read on orgs where the role holds it", async () => {
    const repositories = setup.getAllRepositories()
    const { organization, user: owner } = await createOrganizationWithOwner(repositories)
    const { organization: otherOrganization } = await createOrganizationWithOwner(repositories)

    await expect(
      service.has(owner.id, BACKOFFICE_ORGANIZATION_READ_PERMISSION, {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(true)

    await expect(
      service.has(owner.id, BACKOFFICE_ORGANIZATION_READ_PERMISSION, {
        type: "organization",
        id: otherOrganization.id,
      }),
    ).resolves.toBe(false)
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

  it("grants organization.create via global platform_superadmin membership", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "superadmin@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const platformSuperadminRole = await repositories.roleRepository.findOneOrFail({
      where: { key: PLATFORM_SUPERADMIN_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: platformSuperadminRole.id,
      }),
    )

    await expect(service.hasGlobal(user.id, ORGANIZATION_CREATE_PERMISSION)).resolves.toBe(true)
  })

  it("denies organization.create to platform_staff members", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "staff@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const platformStaffRole = await repositories.roleRepository.findOneOrFail({
      where: { key: PLATFORM_STAFF_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: platformStaffRole.id,
      }),
    )

    await expect(service.hasGlobal(user.id, ORGANIZATION_CREATE_PERMISSION)).resolves.toBe(false)
  })

  it("denies organization.create without any global membership", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "outsider@example.com" })
    await repositories.userRepository.save(user)

    await expect(service.hasGlobal(user.id, ORGANIZATION_CREATE_PERMISSION)).resolves.toBe(false)
  })

  it("lists global permissions for platform_staff users", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "staff@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const platformStaffRole = await repositories.roleRepository.findOneOrFail({
      where: { key: PLATFORM_STAFF_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: platformStaffRole.id,
      }),
    )

    const permissions = await service.listGlobalPermissions(user.id)
    expect(permissions.sort()).toEqual([BACKOFFICE_READ_PERMISSION, TRACE_READ_PERMISSION])
  })

  it("denies backoffice.terms.update to platform_staff members", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "staff@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const platformStaffRole = await repositories.roleRepository.findOneOrFail({
      where: { key: PLATFORM_STAFF_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: platformStaffRole.id,
      }),
    )

    await expect(service.hasGlobal(user.id, BACKOFFICE_TERMS_UPDATE_PERMISSION)).resolves.toBe(
      false,
    )
  })

  it("lists global permissions for platform_superadmin users", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "superadmin@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const platformSuperadminRole = await repositories.roleRepository.findOneOrFail({
      where: { key: PLATFORM_SUPERADMIN_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: platformSuperadminRole.id,
      }),
    )

    const permissions = await service.listGlobalPermissions(user.id)
    expect(permissions.sort()).toEqual([
      BACKOFFICE_AGENT_READ_PERMISSION,
      BACKOFFICE_ORGANIZATION_READ_PERMISSION,
      BACKOFFICE_PROJECT_READ_PERMISSION,
      BACKOFFICE_PROJECT_UPDATE_PERMISSION,
      BACKOFFICE_READ_PERMISSION,
      BACKOFFICE_TERMS_UPDATE_PERMISSION,
      BACKOFFICE_USER_READ_PERMISSION,
      ORGANIZATION_CREATE_PERMISSION,
      TRACE_READ_PERMISSION,
    ])
  })

  describe("listUserIds", () => {
    it("returns the whole directory scope for backoffice.user.read holders", async () => {
      const repositories = setup.getAllRepositories()
      const superadmin = userFactory.build({ email: "superadmin@bayesimpact.org" })
      await repositories.userRepository.save(superadmin)
      const platformSuperadminRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PLATFORM_SUPERADMIN_ROLE },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: superadmin.id,
          resourceType: "global",
          resourceId: null,
          role: "member",
          roleId: platformSuperadminRole.id,
        }),
      )

      await expect(service.listUserIds(superadmin.id)).resolves.toEqual({ scope: "all" })
    })

    it("lists members of resources where the user's role grants user.read", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user: owner } = await createOrganizationWithOwner(repositories)

      const fellowMember = userFactory.build()
      const strangerUser = userFactory.build()
      await repositories.userRepository.save([fellowMember, strangerUser])
      const memberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: fellowMember.id,
          resourceType: "organization",
          resourceId: organization.id,
          role: "member",
          roleId: memberRole.id,
        }),
      )

      const scope = await service.listUserIds(owner.id)

      expect(scope.scope).toBe("ids")
      if (scope.scope === "ids") {
        expect(scope.ids.sort()).toEqual([owner.id, fellowMember.id].sort())
        expect(scope.ids).not.toContain(strangerUser.id)
      }
    })

    it("only lists the user themselves for roles without user.read", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)

      // org_member does not grant user.read: no fellow-member visibility
      const memberUser = userFactory.build()
      await repositories.userRepository.save(memberUser)
      const memberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: memberUser.id,
          resourceType: "organization",
          resourceId: organization.id,
          role: "member",
          roleId: memberRole.id,
        }),
      )

      await expect(service.listUserIds(memberUser.id)).resolves.toEqual({
        scope: "ids",
        ids: [memberUser.id],
      })
    })

    it("returns only the user themselves without any membership", async () => {
      const repositories = setup.getAllRepositories()
      const loneUser = userFactory.build()
      await repositories.userRepository.save(loneUser)

      await expect(service.listUserIds(loneUser.id)).resolves.toEqual({
        scope: "ids",
        ids: [loneUser.id],
      })
    })
  })

  describe("listResourceIds", () => {
    it("lists every organization when backoffice.organization.read is held globally", async () => {
      const repositories = setup.getAllRepositories()
      const { organization: organizationA } = await createOrganizationWithOwner(repositories)
      const { organization: organizationB } = await createOrganizationWithOwner(repositories)

      const superadmin = userFactory.build({ email: "superadmin@bayesimpact.org" })
      await repositories.userRepository.save(superadmin)
      const platformSuperadminRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PLATFORM_SUPERADMIN_ROLE },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: superadmin.id,
          resourceType: "global",
          resourceId: null,
          role: "member",
          roleId: platformSuperadminRole.id,
        }),
      )

      const organizationIds = await service.listResourceIds(
        superadmin.id,
        BACKOFFICE_ORGANIZATION_READ_PERMISSION,
      )
      expect(organizationIds.sort()).toEqual([organizationA.id, organizationB.id].sort())
    })

    it("lists organizations where the user's role grants backoffice.organization.read", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user: owner } = await createOrganizationWithOwner(repositories)
      const { organization: otherOrganization } = await createOrganizationWithOwner(repositories)

      const organizationIds = await service.listResourceIds(
        owner.id,
        BACKOFFICE_ORGANIZATION_READ_PERMISSION,
      )
      expect(organizationIds).toEqual([organization.id])
      expect(organizationIds).not.toContain(otherOrganization.id)
    })

    it("lists no organizations for org_member (no backoffice.organization.read)", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)

      const memberUser = userFactory.build()
      await repositories.userRepository.save(memberUser)
      const memberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: memberUser.id,
          resourceType: "organization",
          resourceId: organization.id,
          role: "member",
          roleId: memberRole.id,
        }),
      )

      await expect(
        service.listResourceIds(memberUser.id, BACKOFFICE_ORGANIZATION_READ_PERMISSION),
      ).resolves.toEqual([])
    })

    it("lists resource ids the user can read through a direct membership", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await expect(service.listResourceIds(user.id, "organization.read")).resolves.toEqual([
        organization.id,
      ])
    })

    it("lists child resource ids inherited from a parent membership", async () => {
      const repositories = setup.getAllRepositories()
      // an ad-hoc org role holds project.read on the organization, no project membership
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [PROJECT_READ_PERMISSION])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organization.id, orgRole)

      await expect(service.listResourceIds(orgUser.id, "project.read")).resolves.toEqual([
        project.id,
      ])
    })

    it("does not list the org's projects for an org owner without project membership", async () => {
      const repositories = setup.getAllRepositories()
      // catalog org roles do not grant project.read: no implicit project visibility
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      await expect(service.listResourceIds(user.id, "project.read")).resolves.toEqual([])
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

      await expect(service.listResourceIds(projectUser.id, "project.read")).resolves.toEqual([])
    })

    it("returns an empty array when the user has no access", async () => {
      const repositories = setup.getAllRepositories()
      const user = userFactory.build()
      await repositories.userRepository.save(user)

      await expect(service.listResourceIds(user.id, "organization.read")).resolves.toEqual([])
    })

    it("combines ids inherited from an organization role and a project role", async () => {
      const repositories = setup.getAllRepositories()
      // roles are not wiped by clearTestDatabase: remove any leftover ad-hoc role
      await repositories.roleRepository.delete({ key: "test_org_agent_reader_ids" })

      try {
        // org A: ad-hoc org role granting agent.read, one agent
        const { organization: organizationA } = await createOrganizationWithOwner(repositories)
        const projectA = projectFactory.transient({ organization: organizationA }).build()
        await repositories.projectRepository.save(projectA)
        const agentA = agentFactory
          .transient({ organization: organizationA, project: projectA })
          .build()
        await repositories.agentRepository.save(agentA)

        // org B: project role granting agent.read, one agent
        const { organization: organizationB } = await createOrganizationWithOwner(repositories)
        const projectB = projectFactory.transient({ organization: organizationB }).build()
        await repositories.projectRepository.save(projectB)
        const agentB = agentFactory
          .transient({ organization: organizationB, project: projectB })
          .build()
        await repositories.agentRepository.save(agentB)

        const orgRole = await repositories.roleRepository.save(
          repositories.roleRepository.create({
            key: "test_org_agent_reader_ids",
            name: "Test Org Agent Reader (ids)",
            scopeType: "organization",
          }),
        )
        await setup.dataSource.query(
          `INSERT INTO role_permission (role_id, permission_key) VALUES ($1, $2)`,
          [orgRole.id, "agent.read"],
        )
        const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
          where: { key: PROJECT_ROLES.owner },
        })

        const user = userFactory.build()
        await repositories.userRepository.save(user)
        await repositories.userMembershipRepository.save([
          userMembershipFactory.build({
            userId: user.id,
            resourceType: "organization",
            resourceId: organizationA.id,
            role: "member",
            roleId: orgRole.id,
          }),
          userMembershipFactory.build({
            userId: user.id,
            resourceType: "project",
            resourceId: projectB.id,
            role: "owner",
            roleId: projectOwnerRole.id,
          }),
        ])

        // both inheritance sources must contribute: matching the organization
        // parent type must not shadow the project parent type
        const agentIds = await service.listResourceIds(user.id, "agent.read")
        expect(agentIds.sort()).toEqual([agentA.id, agentB.id].sort())
      } finally {
        const testRole = await repositories.roleRepository.findOne({
          where: { key: "test_org_agent_reader_ids" },
        })
        if (testRole) {
          await repositories.userMembershipRepository.delete({ roleId: testRole.id })
          await repositories.roleRepository.delete({ id: testRole.id })
        }
      }
    })
  })

  describe("listResourcePermissions", () => {
    it("inherits project permissions from an organization role granting project.read", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [
        PROJECT_CREATE_PERMISSION,
        PROJECT_READ_PERMISSION,
      ])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organization.id, orgRole)

      const permissionsByProjectId = await service.listResourcePermissions(
        orgUser.id,
        "project.read",
      )

      expect([...permissionsByProjectId.keys()]).toEqual([project.id])
      expect(permissionsByProjectId.get(project.id)?.sort()).toEqual(
        ["project.create", "project.read"].sort(),
      )
    })

    it("does not inherit project permissions from the catalog org owner role", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const permissionsByProjectId = await service.listResourcePermissions(user.id, "project.read")

      expect(permissionsByProjectId.size).toBe(0)
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
        "project.read",
      )

      expect(permissionsByProjectId.get(project.id)).toEqual([PROJECT_READ_PERMISSION])
    })

    it("merges direct project permissions with inherited organization permissions", async () => {
      const repositories = setup.getAllRepositories()
      // ad-hoc org role: inherits project.create + project.read on every project of the org
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [
        PROJECT_CREATE_PERMISSION,
        PROJECT_READ_PERMISSION,
      ])
      const user = userFactory.build()
      await repositories.userRepository.save(user)
      await addOrgMembershipWithRole(user.id, organization.id, orgRole)

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

      const permissionsByProjectId = await service.listResourcePermissions(user.id, "project.read")

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
          "project.read",
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

    it("lists direct organization permissions", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user } = await createOrganizationWithOwner(repositories)

      const permissionsByOrganizationId = await service.listResourcePermissions(
        user.id,
        "organization.read",
      )

      expect([...permissionsByOrganizationId.keys()]).toEqual([organization.id])
      expect(permissionsByOrganizationId.get(organization.id)?.sort()).toEqual(
        [...ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.owner]].sort(),
      )
    })

    it("does not leak project permissions across organizations", async () => {
      const repositories = setup.getAllRepositories()
      // project reader on org A asking about projects: org B's project must not appear
      const { organization: organizationA } = await createOrganizationWithOwner(repositories)
      const { organization: organizationB } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization: organizationB }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [PROJECT_READ_PERMISSION])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organizationA.id, orgRole)

      const permissionsByProjectId = await service.listResourcePermissions(
        orgUser.id,
        "project.read",
      )

      expect(permissionsByProjectId.size).toBe(0)
    })

    it("keeps permissions scoped per resource id", async () => {
      const repositories = setup.getAllRepositories()
      // the org role inherits on both projects, but the user holds a direct role on only one
      const { organization } = await createOrganizationWithOwner(repositories)
      const inheritedOnlyProject = projectFactory.transient({ organization }).build()
      const ownedProject = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save([inheritedOnlyProject, ownedProject])

      const orgRole = await recreateOrgRole("test_org_project_reader", [
        PROJECT_CREATE_PERMISSION,
        PROJECT_READ_PERMISSION,
      ])
      const user = userFactory.build()
      await repositories.userRepository.save(user)
      await addOrgMembershipWithRole(user.id, organization.id, orgRole)

      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: user.id,
          resourceType: "project",
          resourceId: ownedProject.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      const permissionsByProjectId = await service.listResourcePermissions(user.id, "project.read")

      expect(permissionsByProjectId.size).toBe(2)
      expect(permissionsByProjectId.get(inheritedOnlyProject.id)?.sort()).toEqual(
        ["project.create", "project.read"].sort(),
      )
      expect(permissionsByProjectId.get(ownedProject.id)?.sort()).toEqual(
        [...new Set([...PROJECT_ROLE_PERMISSIONS.project_owner, "project.create"])].sort(),
      )
    })

    it("ignores soft-deleted memberships", async () => {
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
          deletedAt: new Date(),
        }),
      )

      const permissionsByProjectId = await service.listResourcePermissions(
        projectUser.id,
        "project.read",
      )

      expect(permissionsByProjectId.size).toBe(0)
    })

    it("excludes soft-deleted projects from inheritance", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)
      await repositories.projectRepository.softDelete(project.id)

      const orgRole = await recreateOrgRole("test_org_project_reader", [PROJECT_READ_PERMISSION])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organization.id, orgRole)

      const permissionsByProjectId = await service.listResourcePermissions(
        orgUser.id,
        "project.read",
      )

      expect(permissionsByProjectId.size).toBe(0)
    })

    it("excludes projects of a soft-deleted organization from inheritance", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [PROJECT_READ_PERMISSION])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organization.id, orgRole)

      // the org membership survives (only the organization is soft-deleted)
      await repositories.organizationRepository.softDelete(organization.id)

      const permissionsByProjectId = await service.listResourcePermissions(
        orgUser.id,
        "project.read",
      )

      expect(permissionsByProjectId.size).toBe(0)
    })

    it("excludes agents of a soft-deleted project from inheritance", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      // the membership survives (only the project is soft-deleted): it must convey nothing
      await repositories.projectRepository.softDelete(project.id)

      const permissionsByAgentId = await service.listResourcePermissions(
        projectUser.id,
        "agent.read",
      )

      expect(permissionsByAgentId.size).toBe(0)
    })

    it("inherits agent.read on the project's agents from a project role, gated by the type map", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      // project_owner grants agent.read, agent.create, and backoffice.agent.read;
      // only agent.* + backoffice.agent.read apply to an agent resource
      // (RESOURCE_TYPE_PERMISSIONS_MAP.agent)
      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      const permissionsByAgentId = await service.listResourcePermissions(
        projectUser.id,
        "agent.read",
      )

      expect([...permissionsByAgentId.keys()]).toEqual([agent.id])
      expect(permissionsByAgentId.get(agent.id)?.sort()).toEqual(
        ["agent.read", BACKOFFICE_AGENT_READ_PERMISSION].sort(),
      )
    })

    it("returns an empty map when the user has no access", async () => {
      const repositories = setup.getAllRepositories()
      const user = userFactory.build()
      await repositories.userRepository.save(user)

      const permissionsByProjectId = await service.listResourcePermissions(user.id, "project.read")

      expect(permissionsByProjectId.size).toBe(0)
    })

    it("combines permissions inherited from an organization role and a project role, agreeing with has()", async () => {
      const repositories = setup.getAllRepositories()
      // roles are not wiped by clearTestDatabase: remove any leftover ad-hoc role
      await repositories.roleRepository.delete({ key: "test_org_agent_reader_perms" })

      try {
        // org A: ad-hoc org role granting agent.read, one agent
        const { organization: organizationA } = await createOrganizationWithOwner(repositories)
        const projectA = projectFactory.transient({ organization: organizationA }).build()
        await repositories.projectRepository.save(projectA)
        const agentA = agentFactory
          .transient({ organization: organizationA, project: projectA })
          .build()
        await repositories.agentRepository.save(agentA)

        // org B: project role granting agent.read, one agent
        const { organization: organizationB } = await createOrganizationWithOwner(repositories)
        const projectB = projectFactory.transient({ organization: organizationB }).build()
        await repositories.projectRepository.save(projectB)
        const agentB = agentFactory
          .transient({ organization: organizationB, project: projectB })
          .build()
        await repositories.agentRepository.save(agentB)

        const orgRole = await repositories.roleRepository.save(
          repositories.roleRepository.create({
            key: "test_org_agent_reader_perms",
            name: "Test Org Agent Reader (perms)",
            scopeType: "organization",
          }),
        )
        await setup.dataSource.query(
          `INSERT INTO role_permission (role_id, permission_key) VALUES ($1, $2)`,
          [orgRole.id, "agent.read"],
        )
        const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
          where: { key: PROJECT_ROLES.owner },
        })

        const user = userFactory.build()
        await repositories.userRepository.save(user)
        await repositories.userMembershipRepository.save([
          userMembershipFactory.build({
            userId: user.id,
            resourceType: "organization",
            resourceId: organizationA.id,
            role: "member",
            roleId: orgRole.id,
          }),
          userMembershipFactory.build({
            userId: user.id,
            resourceType: "project",
            resourceId: projectB.id,
            role: "owner",
            roleId: projectOwnerRole.id,
          }),
        ])

        // has() grants agent B through the project parent...
        await expect(
          service.has(user.id, "agent.read", { type: "agent", id: agentB.id }),
        ).resolves.toBe(true)

        // ...so the listing must surface it too: matching the organization
        // parent type must not shadow the project parent type
        const permissionsByAgentId = await service.listResourcePermissions(user.id, "agent.read")
        expect([...permissionsByAgentId.keys()].sort()).toEqual([agentA.id, agentB.id].sort())
        expect(permissionsByAgentId.get(agentB.id)?.sort()).toEqual(
          ["agent.read", BACKOFFICE_AGENT_READ_PERMISSION].sort(),
        )
      } finally {
        const testRole = await repositories.roleRepository.findOne({
          where: { key: "test_org_agent_reader_perms" },
        })
        if (testRole) {
          await repositories.userMembershipRepository.delete({ roleId: testRole.id })
          await repositories.roleRepository.delete({ id: testRole.id })
        }
      }
    })
  })

  describe("has (scoped, with inheritance)", () => {
    it("grants an inheritable permission on a child project via an org role granting it", async () => {
      const repositories = setup.getAllRepositories()
      // an ad-hoc org role holds project.read on the organization, no project membership
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [PROJECT_READ_PERMISSION])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organization.id, orgRole)

      await expect(
        service.has(orgUser.id, PROJECT_READ_PERMISSION, { type: "project", id: project.id }),
      ).resolves.toBe(true)
    })

    it("denies project.read on a child project to org owners and admins without project membership", async () => {
      const repositories = setup.getAllRepositories()
      // regression: catalog org roles must not convey project visibility
      const { organization, user: ownerUser } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const adminRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.admin },
      })
      const adminUser = userFactory.build()
      await repositories.userRepository.save(adminUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: adminUser.id,
          resourceType: "organization",
          resourceId: organization.id,
          role: "admin",
          roleId: adminRole.id,
        }),
      )

      await expect(
        service.has(ownerUser.id, PROJECT_READ_PERMISSION, { type: "project", id: project.id }),
      ).resolves.toBe(false)
      await expect(
        service.has(adminUser.id, PROJECT_READ_PERMISSION, { type: "project", id: project.id }),
      ).resolves.toBe(false)
    })

    it("denies a non-inheritable permission on a child project to the org owner", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      // project.update is not in RESOURCE_TYPE_PERMISSIONS_MAP.project:
      // only a direct project role can grant it
      await expect(
        service.has(user.id, "project.update", { type: "project", id: project.id }),
      ).resolves.toBe(false)
    })

    it("grants a direct project permission to the project owner", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      await expect(
        service.has(projectUser.id, "project.update", { type: "project", id: project.id }),
      ).resolves.toBe(true)
    })

    it("does not inherit across organizations", async () => {
      const repositories = setup.getAllRepositories()
      // project reader on org A asking about a project of org B
      const { organization: organizationA } = await createOrganizationWithOwner(repositories)
      const { organization: organizationB } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization: organizationB }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [PROJECT_READ_PERMISSION])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organizationA.id, orgRole)

      await expect(
        service.has(orgUser.id, PROJECT_READ_PERMISSION, {
          type: "project",
          id: project.id,
        }),
      ).resolves.toBe(false)
    })

    it("denies inherited project.read to a plain org member", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const memberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      const memberUser = userFactory.build()
      await repositories.userRepository.save(memberUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: memberUser.id,
          resourceType: "organization",
          resourceId: organization.id,
          role: "member",
          roleId: memberRole.id,
        }),
      )

      await expect(
        service.has(memberUser.id, PROJECT_READ_PERMISSION, { type: "project", id: project.id }),
      ).resolves.toBe(false)
    })

    it("scopes project.create to the organization the role is held on", async () => {
      const repositories = setup.getAllRepositories()
      // owner of org A (role grants project.create), plain member of org B
      const { organization: organizationA, user } = await createOrganizationWithOwner(repositories)
      const { organization: organizationB } = await createOrganizationWithOwner(repositories)

      const memberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: user.id,
          resourceType: "organization",
          resourceId: organizationB.id,
          role: "member",
          roleId: memberRole.id,
        }),
      )

      await expect(
        service.has(user.id, PROJECT_CREATE_PERMISSION, {
          type: "organization",
          id: organizationA.id,
        }),
      ).resolves.toBe(true)

      // the permission held on org A must not leak onto org B
      await expect(
        service.has(user.id, PROJECT_CREATE_PERMISSION, {
          type: "organization",
          id: organizationB.id,
        }),
      ).resolves.toBe(false)
    })

    it("grants inherited agent.read via a role on the parent project", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      // the organization parent is probed first and grants nothing:
      // the loop must fall through to the project parent
      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      await expect(
        service.has(projectUser.id, "agent.read", { type: "agent", id: agent.id }),
      ).resolves.toBe(true)
    })

    it("grants inherited agent.read via a role on the parent organization", async () => {
      const repositories = setup.getAllRepositories()
      // roles are not wiped by clearTestDatabase: remove any leftover ad-hoc role
      await repositories.roleRepository.delete({ key: "test_org_agent_reader" })

      try {
        const { organization } = await createOrganizationWithOwner(repositories)
        const project = projectFactory.transient({ organization }).build()
        await repositories.projectRepository.save(project)
        const agent = agentFactory.transient({ organization, project }).build()
        await repositories.agentRepository.save(agent)

        // no catalog org role grants agent.read: an ad-hoc one exercises the
        // agent -> organization ancestor path
        const orgRole = await repositories.roleRepository.save(
          repositories.roleRepository.create({
            key: "test_org_agent_reader",
            name: "Test Org Agent Reader",
            scopeType: "organization",
          }),
        )
        await setup.dataSource.query(
          `INSERT INTO role_permission (role_id, permission_key) VALUES ($1, $2)`,
          [orgRole.id, "agent.read"],
        )

        const orgUser = userFactory.build()
        await repositories.userRepository.save(orgUser)
        await repositories.userMembershipRepository.save(
          userMembershipFactory.build({
            userId: orgUser.id,
            resourceType: "organization",
            resourceId: organization.id,
            role: "member",
            roleId: orgRole.id,
          }),
        )

        await expect(
          service.has(orgUser.id, "agent.read", { type: "agent", id: agent.id }),
        ).resolves.toBe(true)

        // an agent of a soft-deleted project must not be reachable, even org-wide
        const deletedProject = projectFactory.transient({ organization }).build()
        await repositories.projectRepository.save(deletedProject)
        const orphanedAgent = agentFactory
          .transient({ organization, project: deletedProject })
          .build()
        await repositories.agentRepository.save(orphanedAgent)
        await repositories.projectRepository.softDelete(deletedProject.id)

        await expect(
          service.has(orgUser.id, "agent.read", { type: "agent", id: orphanedAgent.id }),
        ).resolves.toBe(false)
      } finally {
        const testRole = await repositories.roleRepository.findOne({
          where: { key: "test_org_agent_reader" },
        })
        if (testRole) {
          await repositories.userMembershipRepository.delete({ roleId: testRole.id })
          await repositories.roleRepository.delete({ id: testRole.id })
        }
      }
    })

    it("does not inherit agent.read through a soft-deleted project", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      // the membership survives (only the project is soft-deleted): it must convey nothing
      await repositories.projectRepository.softDelete(project.id)

      await expect(
        service.has(projectUser.id, "agent.read", { type: "agent", id: agent.id }),
      ).resolves.toBe(false)
    })

    it("does not inherit project.read when the organization is soft-deleted", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)

      const orgRole = await recreateOrgRole("test_org_project_reader", [PROJECT_READ_PERMISSION])
      const orgUser = userFactory.build()
      await repositories.userRepository.save(orgUser)
      await addOrgMembershipWithRole(orgUser.id, organization.id, orgRole)

      await repositories.organizationRepository.softDelete(organization.id)

      await expect(
        service.has(orgUser.id, PROJECT_READ_PERMISSION, { type: "project", id: project.id }),
      ).resolves.toBe(false)
    })

    it("denies agent.create on an agent even to the project owner (type map gate)", async () => {
      const repositories = setup.getAllRepositories()
      const { organization } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      // project_owner grants agent.create (on the project), but agent.create is
      // not in RESOURCE_TYPE_PERMISSIONS_MAP.agent so it never applies to an agent
      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      const projectUser = userFactory.build()
      await repositories.userRepository.save(projectUser)
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: projectUser.id,
          resourceType: "project",
          resourceId: project.id,
          role: "owner",
          roleId: projectOwnerRole.id,
        }),
      )

      await expect(
        service.has(projectUser.id, "agent.create", { type: "agent", id: agent.id }),
      ).resolves.toBe(false)
    })

    it("ignores soft-deleted memberships", async () => {
      const repositories = setup.getAllRepositories()
      const { organization, user } = await createOrganizationWithOwner(repositories)
      await repositories.userMembershipRepository.update(
        { userId: user.id, resourceType: "organization", resourceId: organization.id },
        { deletedAt: new Date() },
      )

      await expect(
        service.has(user.id, "organization.update", {
          type: "organization",
          id: organization.id,
        }),
      ).resolves.toBe(false)
    })

    it("returns false for an unknown resource id", async () => {
      const repositories = setup.getAllRepositories()
      const { user } = await createOrganizationWithOwner(repositories)

      await expect(
        service.has(user.id, PROJECT_READ_PERMISSION, { type: "project", id: randomUUID() }),
      ).resolves.toBe(false)
    })

    it("never inherits a permission excluded by the resource type map, even if the parent role grants it", async () => {
      const repositories = setup.getAllRepositories()
      // roles are not wiped by clearTestDatabase: remove any leftover ad-hoc role
      await repositories.roleRepository.delete({ key: "test_org_project_updater" })

      try {
        const { organization } = await createOrganizationWithOwner(repositories)
        const project = projectFactory.transient({ organization }).build()
        await repositories.projectRepository.save(project)

        // ad-hoc org role granting project.update: the map gate must still block inheritance
        const orgRole = await repositories.roleRepository.save(
          repositories.roleRepository.create({
            key: "test_org_project_updater",
            name: "Test Org Project Updater",
            scopeType: "organization",
          }),
        )
        await setup.dataSource.query(
          `INSERT INTO role_permission (role_id, permission_key) VALUES ($1, $2)`,
          [orgRole.id, "project.update"],
        )

        const orgUser = userFactory.build()
        await repositories.userRepository.save(orgUser)
        await repositories.userMembershipRepository.save(
          userMembershipFactory.build({
            userId: orgUser.id,
            resourceType: "organization",
            resourceId: organization.id,
            role: "member",
            roleId: orgRole.id,
          }),
        )

        await expect(
          service.has(orgUser.id, "project.update", { type: "project", id: project.id }),
        ).resolves.toBe(false)
      } finally {
        const testRole = await repositories.roleRepository.findOne({
          where: { key: "test_org_project_updater" },
        })
        if (testRole) {
          await repositories.userMembershipRepository.delete({ roleId: testRole.id })
          await repositories.roleRepository.delete({ id: testRole.id })
        }
      }
    })
  })
})

describe("RbacService", () => {
  let service: RbacService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    service = setup.module.get(RbacService)
    await service.seedOrganizationRolesAndPermissions()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  it("seeds org roles and permissions idempotently", async () => {
    await service.seedOrganizationRolesAndPermissions()

    const orgRoleKeys = [
      ...Object.values(ORGANIZATION_ROLES),
      PLATFORM_STAFF_ROLE,
      PLATFORM_SUPERADMIN_ROLE,
    ]
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

  it("seeds agent roles and permissions idempotently", async () => {
    await service.seedAgentRolesAndPermissions()
    await service.seedAgentRolesAndPermissions()

    const agentRoleKeys = Object.values(AGENT_ROLES)
    const roles = await setup.getRepository(Role).find({ where: { key: In(agentRoleKeys) } })
    expect(roles.map((role) => role.key).sort()).toEqual([...agentRoleKeys].sort())
    expect(roles.every((role) => role.scopeType === "agent")).toBe(true)

    const rolePermissions = await setup.getRepository(RolePermission).find({
      where: { roleId: In(roles.map((role) => role.id)) },
    })
    const expectedLinks = Object.values(AGENT_ROLE_PERMISSIONS).flatMap((keys) => [...keys])
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

  it("assigns role_id on agent memberships", async () => {
    await service.seedAgentRolesAndPermissions()
    const repositories = setup.getAllRepositories()
    const { organization } = await createOrganizationWithOwner(repositories)
    const project = projectFactory.transient({ organization }).build()
    await repositories.projectRepository.save(project)
    const agent = agentFactory.transient({ project, organization }).build()
    await repositories.agentRepository.save(agent)

    const agentUser = userFactory.build()
    await repositories.userRepository.save(agentUser)
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: agentUser.id,
        resourceType: "agent",
        resourceId: agent.id,
        role: "member",
        roleId: null,
      }),
    )

    await service.assignRoleIdsToAgentMemberships()

    const membership = await setup.getRepository(UserMembership).findOneOrFail({
      where: { userId: agentUser.id, resourceId: agent.id, resourceType: "agent" },
    })
    const agentMemberRole = await setup.getRepository(Role).findOneOrFail({
      where: { key: AGENT_ROLES.member },
    })
    expect(membership.roleId).toBe(agentMemberRole.id)
  })
})
