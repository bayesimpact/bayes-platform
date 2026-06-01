import { randomUUID } from "node:crypto"
import { ProjectAgentCategoriesRoutes } from "@caseai-connect/api-contracts"
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
import { AgentsModule } from "@/domains/agents/agents.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"

describe("ProjectAgentCategories - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = RandomUuid.Organization
  let projectId: string | null = RandomUuid.Project
  let categoryId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = RandomUuid.Organization
    projectId = RandomUuid.Project
    categoryId = randomUUID()
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    accessToken = "token"
    return { organization, project }
  }

  describe("ProjectAgentCategoriesRoutes.createOne", () => {
    const subject = async (payload?: typeof ProjectAgentCategoriesRoutes.createOne.request) =>
      request({
        route: ProjectAgentCategoriesRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: payload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      organizationId = ":organizationId"
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(
        await subject({ payload: { name: "Support", assignToAllConversationalAgents: false } }),
        404,
      )
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(
        await subject({ payload: { name: "Support", assignToAllConversationalAgents: false } }),
        401,
        AUTH_ERRORS.NOT_MEMBER_OF_ORG,
      )
    })

    it("does not allow a simple member to create a category", async () => {
      await createContextForRole("member")
      expectResponse(
        await subject({ payload: { name: "Support", assignToAllConversationalAgents: false } }),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })

    it("allows an admin to create a category", async () => {
      await createContextForRole("admin")
      expectResponse(
        await subject({ payload: { name: "Support", assignToAllConversationalAgents: false } }),
        201,
      )
    })

    it("allows an owner to create a category", async () => {
      await createContextForRole("owner")
      expectResponse(
        await subject({ payload: { name: "Support", assignToAllConversationalAgents: false } }),
        201,
      )
    })
  })

  describe("ProjectAgentCategoriesRoutes.deleteOne", () => {
    const subject = async () =>
      request({
        route: ProjectAgentCategoriesRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, categoryId }),
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

    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("does not allow a simple member to delete a category", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows an owner to delete a category (returns 200 even if category not found)", async () => {
      await createContextForRole("owner")
      expectResponse(await subject(), 200)
    })
  })
})
