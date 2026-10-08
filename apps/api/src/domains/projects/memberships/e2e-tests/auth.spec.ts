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

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: { role },
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
      membership: { role: "admin" },
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
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires an existing project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to list project memberships", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner to list project memberships", async () => {
      await createContextForRole("owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to list project memberships", async () => {
      await createContextForRole("admin")
      expectResponse(await subject(), 200)
    })
    it("forbids an organization admin without a project role from listing", async () => {
      const { organization } = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("ProjectMembershipRoutes.getMemberAgents", () => {
    let membershipId: string | null = "random-membership-id"

    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.getMemberAgents,
        pathParams: removeNullish({ organizationId, projectId, membershipId }),
        token: accessToken ?? undefined,
      })

    const createContextForRoleWithMembership = async (
      role: "owner" | "admin" | "member" = "owner",
    ) => {
      const { organization, project } = await createContextForRole(role)

      const { membership } = await addMemberByEmailToProject({
        repositories,
        organization,
        project,
      })
      membershipId = membership.id

      return { organization, project, membership }
    }

    beforeEach(() => {
      membershipId = "random-membership-id"
    })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRoleWithMembership("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to see a member's agents", async () => {
      await createContextForRoleWithMembership("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin without a project role from seeing a member's agents", async () => {
      const { organization } = await createContextForRoleWithMembership("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner to see a member's agents", async () => {
      await createContextForRoleWithMembership("owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to see a member's agents", async () => {
      await createContextForRoleWithMembership("admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("ProjectMembershipRoutes.deleteOne", () => {
    let membershipId: string | null = "random-membership-id"

    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, membershipId }),
        token: accessToken ?? undefined,
      })

    const createContextForRoleWithMembership = async (
      role: "owner" | "admin" | "member" = "owner",
    ) => {
      const { organization, project } = await createContextForRole(role)

      // A member added by email who has not signed in yet
      const { membership } = await addMemberByEmailToProject({
        repositories,
        organization,
        project,
      })
      membershipId = membership.id

      return { organization, project, membership }
    }

    beforeEach(() => {
      membershipId = "random-membership-id"
    })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRoleWithMembership("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRoleWithMembership("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires an existing project ID", async () => {
      await createContextForRoleWithMembership("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires an existing membership ID", async () => {
      await createContextForRoleWithMembership("owner")
      membershipId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to remove project memberships", async () => {
      await createContextForRoleWithMembership("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin without a project role from removing a membership", async () => {
      const { organization, membership } = await createContextForRoleWithMembership("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)

      expect(
        await repositories.userMembershipRepository.findOne({ where: { id: membership.id } }),
      ).not.toBeNull()
    })
    it("allows the owner to remove a membership", async () => {
      await createContextForRoleWithMembership("owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to remove a membership", async () => {
      await createContextForRoleWithMembership("admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("ProjectMembershipRoutes.updateOne", () => {
    let membershipId: string | null = "random-membership-id"

    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.updateOne,
        pathParams: removeNullish({ organizationId, projectId, membershipId }),
        token: accessToken ?? undefined,
        request: { payload: { role: "admin" } },
      })

    const createContextForRoleWithMembership = async (
      role: "owner" | "admin" | "member" = "owner",
    ) => {
      const { organization, project } = await createContextForRole(role)

      const { membership } = await addMemberByEmailToProject({
        repositories,
        organization,
        project,
        projectMembership: { role: "member" },
      })
      membershipId = membership.id

      return { organization, project, membership }
    }

    beforeEach(() => {
      membershipId = "random-membership-id"
    })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRoleWithMembership("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRoleWithMembership("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires an existing project ID", async () => {
      await createContextForRoleWithMembership("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires an existing membership ID", async () => {
      await createContextForRoleWithMembership("owner")
      membershipId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to change a role", async () => {
      await createContextForRoleWithMembership("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner to change a role", async () => {
      await createContextForRoleWithMembership("owner")
      expectResponse(await subject(), 200)
    })
    it("allows an admin to change a role", async () => {
      await createContextForRoleWithMembership("admin")
      expectResponse(await subject(), 200)
    })
  })
})
