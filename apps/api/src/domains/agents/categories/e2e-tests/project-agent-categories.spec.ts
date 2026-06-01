import { ProjectAgentCategoriesRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { AgentsModule } from "@/domains/agents/agents.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"

describe("ProjectAgentCategories", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  describe("createOne", () => {
    const subject = async (payload?: typeof ProjectAgentCategoriesRoutes.createOne.request) =>
      request({
        route: ProjectAgentCategoriesRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken,
        request: payload,
      })

    it("should create a new category and return it", async () => {
      await createContext()

      const response = await subject({ payload: { name: "Support" } })

      expectResponse(response, 201)
      expect(response.body.data.name).toBe("Support")
      expect(response.body.data.id).toBeDefined()

      await expectActivityCreated("project.add_agent_category")
    })

    it("should restore a previously soft-deleted category", async () => {
      await createContext()

      const first = await subject({ payload: { name: "Support" } })
      const categoryId = first.body.data.id

      await request({
        route: ProjectAgentCategoriesRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, categoryId }),
        token: accessToken,
      })

      const restored = await subject({ payload: { name: "Support" } })

      expectResponse(restored, 201)
      expect(restored.body.data.id).toBe(categoryId)
      expect(restored.body.data.name).toBe("Support")
    })

    it("should trim whitespace from category name", async () => {
      await createContext()

      const response = await subject({ payload: { name: "  Support  " } })

      expectResponse(response, 201)
      expect(response.body.data.name).toBe("Support")
    })

    it("should return 401 when not authenticated", async () => {
      await createContext()
      accessToken = undefined

      const response = await subject({ payload: { name: "Support" } })
      expectResponse(response, 401)
    })
  })

  describe("deleteOne", () => {
    const subject = async (categoryId: string) =>
      request({
        route: ProjectAgentCategoriesRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, categoryId }),
        token: accessToken,
      })

    it("should soft-delete a category and return success", async () => {
      await createContext()

      const created = await request({
        route: ProjectAgentCategoriesRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken,
        request: { payload: { name: "Support" } },
      })
      const categoryId = created.body.data.id

      const response = await subject(categoryId)

      expectResponse(response, 200)
      expect(response.body.data.success).toBe(true)

      await expectActivityCreated("project.delete_agent_category")
    })

    it("should return 401 when not authenticated", async () => {
      await createContext()
      accessToken = undefined

      const response = await subject("some-id")
      expectResponse(response, 401)
    })
  })
})
