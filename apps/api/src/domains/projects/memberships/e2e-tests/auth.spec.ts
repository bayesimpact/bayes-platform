import { randomUUID } from "node:crypto"
import { ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { addMemberByEmailToProject } from "../project-membership.factory"

describe("Project Memberships - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectRoleKey = "project_owner") => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: { roleKeys: [role] },
    })
    organizationId = organization.id
    projectId = project.id
    accessToken = "token"
    return { organization, project, user }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async (organization: Organization) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
  }

  describe("ProjectMembershipRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("project_owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires an existing project ID", async () => {
      await createContextForRole("project_owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to list project memberships", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner to list project memberships", async () => {
      await createContextForRole("project_owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to list project memberships", async () => {
      await createContextForRole("project_admin")
      expectResponse(await subject(), 200)
    })
    it("forbids an organization admin without a project role from listing", async () => {
      const { organization } = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("ProjectMembershipRoutes.getMemberRoles", () => {
    let memberUserId: string | null = randomUUID()

    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.getMemberRoles,
        pathParams: removeNullish({ organizationId, projectId, userId: memberUserId }),
        token: accessToken ?? undefined,
      })

    const createContextForRoleWithMembership = async (role: ProjectRoleKey = "project_owner") => {
      const { organization, project } = await createContextForRole(role)

      const { membership } = await addMemberByEmailToProject({
        repositories,
        organization,
        project,
      })
      memberUserId = membership.userId

      return { organization, project, membership }
    }

    beforeEach(() => {
      memberUserId = randomUUID()
    })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRoleWithMembership("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to see a member's agents", async () => {
      await createContextForRoleWithMembership("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin without a project role from seeing a member's agents", async () => {
      const { organization } = await createContextForRoleWithMembership("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner to see a member's agents", async () => {
      await createContextForRoleWithMembership("project_owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to see a member's agents", async () => {
      await createContextForRoleWithMembership("project_admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("ProjectMembershipRoutes.deleteOne", () => {
    let memberUserId: string | null = randomUUID()

    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, userId: memberUserId }),
        token: accessToken ?? undefined,
      })

    const createContextForRoleWithMembership = async (role: ProjectRoleKey = "project_owner") => {
      const { organization, project } = await createContextForRole(role)

      // A member added by email who has not signed in yet
      const { membership } = await addMemberByEmailToProject({
        repositories,
        organization,
        project,
      })
      memberUserId = membership.userId

      return { organization, project, membership }
    }

    beforeEach(() => {
      memberUserId = randomUUID()
    })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRoleWithMembership("project_owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRoleWithMembership("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires an existing project ID", async () => {
      await createContextForRoleWithMembership("project_owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires an existing member", async () => {
      await createContextForRoleWithMembership("project_owner")
      memberUserId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to remove project memberships", async () => {
      await createContextForRoleWithMembership("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin without a project role from removing a membership", async () => {
      const { organization, membership } = await createContextForRoleWithMembership("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)

      expect(
        await repositories.roleGrantRepository.findOne({ where: { id: membership.id } }),
      ).not.toBeNull()
    })
    it("allows the owner to remove a membership", async () => {
      await createContextForRoleWithMembership("project_owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to remove a membership", async () => {
      await createContextForRoleWithMembership("project_admin")
      expectResponse(await subject(), 200)
    })
  })

  /** A member of the caller's project the bulk routes can act on. */
  const addTarget = async (organization: Organization, project: { id: string }) => {
    const { addedUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project: project as Parameters<typeof addMemberByEmailToProject>[0]["project"],
      user: { email: `target-${randomUUID()}@example.com`, authSubject: `oidc|${randomUUID()}` },
      projectMembership: { roleKeys: ["project_member"] },
    })
    return addedUser
  }

  describe("ProjectMembershipRoutes.getAssignableRoles", () => {
    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.getAssignableRoles,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("doesn't allow a simple member", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner and the admin", async () => {
      await createContextForRole("project_owner")
      expectResponse(await subject(), 200)
      await clearTestDatabase(setup.dataSource)
      await createContextForRole("project_admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("ProjectMembershipRoutes.addRoles", () => {
    let userIds: string[] = [randomUUID()]
    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.addRoles,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: { payload: { userIds, roleKeys: ["project_admin"] } },
      })

    const createContext = async (role: ProjectRoleKey) => {
      const { organization, project } = await createContextForRole(role)
      userIds = [(await addTarget(organization, project)).id]
    }

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("doesn't allow a simple member", async () => {
      await createContext("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner", async () => {
      await createContext("project_owner")
      expectResponse(await subject(), 201)
    })
    it("allows the admin", async () => {
      await createContext("project_admin")
      expectResponse(await subject(), 201)
    })
  })

  describe("ProjectMembershipRoutes.removeRole", () => {
    let memberUserId: string = randomUUID()
    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.removeRole,
        pathParams: removeNullish({
          organizationId,
          projectId,
          userId: memberUserId,
          roleKey: "project_member",
        }),
        token: accessToken ?? undefined,
      })

    const createContext = async (role: ProjectRoleKey) => {
      const { organization, project } = await createContextForRole(role)
      const target = await addTarget(organization, project)
      const adminRole = await repositories.roleRepository.findOneOrFail({
        where: { key: "project_admin" },
      })
      await repositories.roleGrantRepository.save(
        repositories.roleGrantRepository.create({
          userId: target.id,
          resourceType: "project",
          resourceId: project.id,
          roleId: adminRole.id,
        }),
      )
      memberUserId = target.id
    }

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("doesn't allow a simple member", async () => {
      await createContext("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner", async () => {
      await createContext("project_owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin", async () => {
      await createContext("project_admin")
      expectResponse(await subject(), 200)
    })
    it("requires an existing member", async () => {
      await createContext("project_owner")
      memberUserId = randomUUID()
      expectResponse(await subject(), 404)
    })
  })

  describe("ProjectMembershipRoutes.deleteMany", () => {
    let userIds: string[] = [randomUUID()]
    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.deleteMany,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: { payload: { userIds } },
      })

    const createContext = async (role: ProjectRoleKey) => {
      const { organization, project } = await createContextForRole(role)
      userIds = [(await addTarget(organization, project)).id]
    }

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("doesn't allow a simple member", async () => {
      await createContext("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner", async () => {
      await createContext("project_owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin", async () => {
      await createContext("project_admin")
      expectResponse(await subject(), 200)
    })
  })
})
