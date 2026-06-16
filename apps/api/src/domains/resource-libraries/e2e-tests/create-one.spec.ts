import { randomUUID } from "node:crypto"
import { ResourceLibrariesRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { ResourceLibrariesModule } from "../resource-libraries.module"
import { ResourceLibrary } from "../resource-library.entity"

describe("ResourceLibraries - createOne", () => {
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
      additionalImports: [ResourceLibrariesModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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
    return { organization, project }
  }

  const subject = async (payload?: typeof ResourceLibrariesRoutes.createOne.request) =>
    request({
      route: ResourceLibrariesRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("creates a resource library with url and file resources", async () => {
    await createContext()

    const urlResourceId = randomUUID()
    const fileResourceId = randomUUID()
    const response = await subject({
      payload: {
        title: "Getting Started",
        resources: [
          {
            id: urlResourceId,
            title: "Intro video",
            description: "A short intro",
            linkType: "url",
            url: "https://example.com/video",
          },
          {
            id: fileResourceId,
            title: "Handbook",
            description: "The handbook",
            linkType: "file",
            file: {
              storageRelativePath: `${organizationId}/${projectId}/handbook.pdf`,
              fileName: "handbook.pdf",
              mimeType: "application/pdf",
            },
          },
        ],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.title).toBe("Getting Started")
    expect(response.body.data.resources).toHaveLength(2)
    expect(response.body.data.projectId).toBe(projectId)

    const stored = await setup.getRepository(ResourceLibrary).findOne({
      where: { id: response.body.data.id },
    })
    expect(stored?.resources).toHaveLength(2)
    expect(
      stored?.resources.find((resource) => resource.id === fileResourceId)?.file?.fileName,
    ).toBe("handbook.pdf")
    await expectActivityCreated("resourceLibrary.create")
  })

  it("rejects a resource whose linkType does not match its payload", async () => {
    await createContext()

    const response = await subject({
      payload: {
        title: "Broken",
        resources: [
          {
            id: randomUUID(),
            title: "Bad",
            description: "missing url",
            linkType: "url",
          },
        ],
      },
    })

    expectResponse(response, 400)
  })
})
