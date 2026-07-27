import { ProjectsRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { ProjectsModule } from "../projects.module"

describe("Projects - updateProject", () => {
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
      additionalImports: [ProjectsModule],
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

  const subject = async (payload?: typeof ProjectsRoutes.updateOne.request) =>
    request({
      route: ProjectsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should update the project name and return the updated project", async () => {
    await createContext()

    const response = await subject({ payload: { name: "Updated Project" } })

    expectResponse(response, 200)
    expect(response.body.data.name).toBe("Updated Project")
    expect(response.body.data.organizationId).toBe(organizationId)

    const updatedProject = await repositories.projectRepository.findOne({
      where: { id: projectId },
    })
    expect(updatedProject?.name).toBe("Updated Project")

    await expectActivityCreated("project.update")
  })

  it("sets the conversation retention in days", async () => {
    const { project } = await createContext()

    const response = await subject({
      payload: { name: project.name, conversationRetentionDays: 30 },
    })

    expectResponse(response, 200)
    expect(response.body.data.conversationRetentionDays).toBe(30)

    const updatedProject = await repositories.projectRepository.findOneByOrFail({ id: projectId })
    expect(updatedProject.conversationRetentionDays).toBe(30)
  })

  it("clears the conversation retention with null", async () => {
    const { project } = await createContext()
    await repositories.projectRepository.update(
      { id: projectId },
      { conversationRetentionDays: 30 },
    )

    const response = await subject({
      payload: { name: project.name, conversationRetentionDays: null },
    })

    expectResponse(response, 200)
    expect(response.body.data.conversationRetentionDays).toBeNull()
  })

  it("keeps the retention untouched when the field is omitted", async () => {
    await createContext()
    await repositories.projectRepository.update(
      { id: projectId },
      { conversationRetentionDays: 30 },
    )

    const response = await subject({ payload: { name: "Renamed Project" } })

    expectResponse(response, 200)
    expect(response.body.data.conversationRetentionDays).toBe(30)
  })

  it("rejects a non-positive retention", async () => {
    const { project } = await createContext()

    const response = await subject({
      payload: { name: project.name, conversationRetentionDays: 0 },
    })

    expectResponse(response, 400)
  })
})
