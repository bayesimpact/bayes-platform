import { randomUUID } from "node:crypto"
import { ProjectsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  RandomUuid,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import {
  createOrganizationWithOwner,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { mockForeignAuthSubject, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { ProjectsModule } from "../projects.module"

describe("Projects - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = RandomUuid.Organization
  let projectId: string | null = RandomUuid.Project
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = RandomUuid.Organization
    projectId = RandomUuid.Project
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    accessToken = "token"
    return { organization, project }
  }

  describe("ProjectsRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: ProjectsRoutes.getAll,
        pathParams: removeNullish({ organizationId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = ":organizationId"
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("allows the owner to list projects", async () => {
      await createContextForRole("owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to list projects", async () => {
      await createContextForRole("admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("ProjectsRoutes.createOne", () => {
    const subject = async (payload?: typeof ProjectsRoutes.createOne.request) =>
      request({
        route: ProjectsRoutes.createOne,
        pathParams: removeNullish({ organizationId }),
        token: accessToken ?? undefined,
        request: payload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = ":organizationId"
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to create projects", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 500)
    })
    it("doesn't allow creating a project in an organization other than the one granting project.create", async () => {
      // the user owns org A (which grants project.create there), but is only a member of org B
      await createContextForRole("owner")
      const { organization: otherOrganization } = await createOrganizationWithOwner(repositories)
      const user = await repositories.userRepository.findOneOrFail({ where: { authSubject } })
      const memberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: user.id,
          resourceType: "organization",
          resourceId: otherOrganization.id,
          role: "member",
          roleId: memberRole.id,
        }),
      )

      organizationId = otherOrganization.id
      expectResponse(
        await subject({ payload: { name: "Sneaky Project" } }),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })
  })

  describe("ProjectsRoutes.deleteOne", () => {
    const subject = async () =>
      request({
        route: ProjectsRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = ":organizationId"
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to belong to the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires an existing project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to delete projects", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("ProjectsRoutes.updateOne", () => {
    const subject = async (payload?: typeof ProjectsRoutes.updateOne.request) =>
      request({
        route: ProjectsRoutes.updateOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: payload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = ":organizationId"
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
    it("doesn't allow a simple member to update a project", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
