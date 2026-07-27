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
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { type Requester, testRequester } from "../../../../test/request"
import { Project } from "../project.entity"
import { ProjectsModule } from "../projects.module"

describe("Projects - createProject", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectCreateActivity: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectCreateActivity = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
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
    const { user, organization } = await createOrganizationWithOwner(repositories)
    organizationId = organization.id
    auth0Id = user.auth0Id
    return { organization }
  }

  const subject = async (payload?: typeof ProjectsRoutes.createOne.request) =>
    request({
      route: ProjectsRoutes.createOne,
      pathParams: removeNullish({ organizationId }),
      token: accessToken,
      request: payload,
    })

  it("should create a project and return it", async () => {
    await createContext()

    const response = await subject({ payload: { name: "New Project" } })

    expect(response.body.data.id).toBeDefined()
    expect(response.body.data.name).toBe("New Project")
    expect(response.body.data.conversationRetentionDays).toBe(30)
    expect(response.body.data.organizationId).toBe(organizationId)

    const projectRepository = setup.getRepository(Project)
    const project = await projectRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(project).not.toBeNull()
    expect(project?.name).toBe("New Project")

    await expectCreateActivity("project.create")
  })
})
