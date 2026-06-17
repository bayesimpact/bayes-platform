import { randomUUID } from "node:crypto"
import { ResourceLibrariesRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
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
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { ResourceLibrariesModule } from "../resource-libraries.module"
import { ResourceLibrary } from "../resource-library.entity"
import { buildResource, createResourceLibraryForProject } from "../resource-library.factory"

describe("ResourceLibraries - updateResource", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let resourceLibraryId: string
  let resourceId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ResourceLibrariesModule],
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
    const resource = buildResource({ title: "Original", url: "https://example.com/original" })
    resourceId = resource.id
    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
      params: { resourceLibrary: { resources: [resource] } },
    })
    resourceLibraryId = resourceLibrary.id
    return { organization, project }
  }

  const subject = async (payload?: typeof ResourceLibrariesRoutes.updateResource.request) =>
    request({
      route: ResourceLibrariesRoutes.updateResource,
      pathParams: removeNullish({ organizationId, projectId, resourceLibraryId, resourceId }),
      token: accessToken,
      request: payload,
    })

  it("updates the targeted resource in place, keeping its id", async () => {
    await createContext()

    const response = await subject({
      payload: {
        title: "Updated",
        description: "new desc",
        linkType: "url",
        url: "https://example.com/updated",
      },
    })

    expectResponse(response, 200)
    expect(response.body.data.resources).toHaveLength(1)
    expect(response.body.data.resources[0]?.id).toBe(resourceId)
    expect(response.body.data.resources[0]?.title).toBe("Updated")

    const stored = await setup
      .getRepository(ResourceLibrary)
      .findOne({ where: { id: resourceLibraryId } })
    expect(stored?.resources[0]?.url).toBe("https://example.com/updated")
  })

  it("returns 404 when the resource does not exist in the library", async () => {
    await createContext()
    resourceId = randomUUID()

    const response = await subject({
      payload: {
        title: "Updated",
        description: "new desc",
        linkType: "url",
        url: "https://example.com/updated",
      },
    })

    expectResponse(response, 404)
  })

  it("rejects a resource whose linkType does not match its payload", async () => {
    await createContext()

    const response = await subject({
      payload: {
        title: "Updated",
        description: "missing file",
        linkType: "file",
      },
    })

    expectResponse(response, 400)
  })
})
