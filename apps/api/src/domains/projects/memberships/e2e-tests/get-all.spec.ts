import { ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"

describe("Project membership - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
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
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project, user }
  }

  const subject = async () =>
    request({
      route: ProjectMembershipRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("should return memberships with user name and email", async () => {
    const { user } = await createContext()

    const response = await subject()

    expectResponse(response, 200)
    const memberships = response.body.data
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.userName).toBe(user.name)
    expect(memberships[0]!.userEmail).toBe(user.email)
    expect(memberships[0]!).toHaveProperty("id")
    expect(memberships[0]!).toHaveProperty("projectId")
    expect(memberships[0]!).toHaveProperty("userId")
    expect(memberships[0]!).toHaveProperty("createdAt")
  })
})
