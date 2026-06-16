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

describe("ResourceLibraries - deleteResource", () => {
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

  const createContext = async (
    resources = [buildResource({ title: "Keep me" }), buildResource()],
  ) => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    resourceId = resources[1]?.id ?? randomUUID()
    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
      params: { resourceLibrary: { resources } },
    })
    resourceLibraryId = resourceLibrary.id
    return { organization, project }
  }

  const subject = async () =>
    request({
      route: ResourceLibrariesRoutes.deleteResource,
      pathParams: removeNullish({ organizationId, projectId, resourceLibraryId, resourceId }),
      token: accessToken,
    })

  it("removes only the targeted resource", async () => {
    await createContext()

    expectResponse(await subject(), 200)

    const stored = await setup
      .getRepository(ResourceLibrary)
      .findOne({ where: { id: resourceLibraryId } })
    expect(stored?.resources).toHaveLength(1)
    expect(stored?.resources[0]?.title).toBe("Keep me")
    expect(stored?.resources.some((resource) => resource.id === resourceId)).toBe(false)
  })

  it("returns 404 when the resource does not exist in the library", async () => {
    await createContext()
    resourceId = randomUUID()

    expectResponse(await subject(), 404)
  })
})
