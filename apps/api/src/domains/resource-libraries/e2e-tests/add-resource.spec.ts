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

describe("ResourceLibraries - addResource", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let resourceLibraryId: string
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
    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
      params: { resourceLibrary: { resources: [] } },
    })
    resourceLibraryId = resourceLibrary.id
    return { organization, project }
  }

  const subject = async (payload?: typeof ResourceLibrariesRoutes.addResource.request) =>
    request({
      route: ResourceLibrariesRoutes.addResource,
      pathParams: removeNullish({ organizationId, projectId, resourceLibraryId }),
      token: accessToken,
      request: payload,
    })

  it("adds a url resource and assigns it a server-generated id", async () => {
    await createContext()

    const response = await subject({
      payload: {
        title: "Intro video",
        description: "A short intro",
        linkType: "url",
        url: "https://example.com/video",
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.resources).toHaveLength(1)
    const created = response.body.data.resources[0]
    expect(created?.title).toBe("Intro video")
    expect(created?.id).toEqual(expect.any(String))

    const stored = await setup
      .getRepository(ResourceLibrary)
      .findOne({ where: { id: resourceLibraryId } })
    expect(stored?.resources).toHaveLength(1)
    expect(stored?.resources[0]?.id).toBe(created?.id)
  })

  it("adds a file resource", async () => {
    await createContext()

    const response = await subject({
      payload: {
        title: "Handbook",
        description: "The handbook",
        linkType: "file",
        file: {
          storageRelativePath: `${organizationId}/${projectId}/handbook.pdf`,
          fileName: "handbook.pdf",
          mimeType: "application/pdf",
        },
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.resources[0]?.file?.fileName).toBe("handbook.pdf")
  })

  it("appends to existing resources without dropping them", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    const resourceLibrary = await createResourceLibraryForProject({
      repositories,
      organization,
      project,
      params: { resourceLibrary: { resources: [buildResource({ title: "Existing" })] } },
    })
    resourceLibraryId = resourceLibrary.id

    const response = await subject({
      payload: {
        title: "Another",
        description: "desc",
        linkType: "url",
        url: "https://example.com/another",
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.resources).toHaveLength(2)
    expect(response.body.data.resources.map((resource) => resource.title)).toEqual(
      expect.arrayContaining(["Existing", "Another"]),
    )
  })

  it("rejects a resource whose linkType does not match its payload", async () => {
    await createContext()

    const response = await subject({
      payload: {
        title: "Bad",
        description: "missing url",
        linkType: "url",
      },
    })

    expectResponse(response, 400)
  })
})
