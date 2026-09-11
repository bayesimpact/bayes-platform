import { DocumentsRoutes } from "@caseai-connect/api-contracts"
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
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import type { Document } from "../../document.entity"
import { DocumentsModule } from "../../documents.module"
import { withCrawlingAndAuthMocks } from "../../test-overrides"
import {
  DOCLING_CRAWLING_BATCH_SERVICE,
  type DoclingCrawlingBatchService,
} from "../docling-crawling-batch.interface"

describe("Documents - crawlUrlDocling", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let userId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let doclingCrawlingBatchServiceMock: {
    enqueueCrawlUrl: jest.MockedFunction<DoclingCrawlingBatchService["enqueueCrawlUrl"]>
  }

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) => withCrawlingAndAuthMocks(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    doclingCrawlingBatchServiceMock = setup.module.get(DOCLING_CRAWLING_BATCH_SERVICE)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    doclingCrawlingBatchServiceMock.enqueueCrawlUrl.mockClear()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    userId = user.id
    organizationId = organization.id
    projectId = project.id
  }

  const subject = async (payload: { url: string; name?: string }) =>
    request({
      route: DocumentsRoutes.crawlUrlDocling,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: { payload },
    })

  it("creates a webCrawl document and enqueues the docling crawl job", async () => {
    await createContext()

    const url = "https://example.com"
    const response = await subject({ url })

    expectResponse(response, 202)
    expect(response.body.data.message).toContain(url)

    const documents = await repositories.documentRepository.find({
      where: { projectId, sourceType: "webCrawl" },
    })
    expect(documents).toHaveLength(1)
    const document = documents[0] as Document
    expect(document.sourceType).toBe("webCrawl")
    expect(document.sourceUrl).toBe(url)
    expect(document.title).toBe(url)
    expect(document.mimeType).toBe("text/html")
    expect(document.embeddingStatus).toBe("pending")

    expect(doclingCrawlingBatchServiceMock.enqueueCrawlUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: document.id,
        url,
        organizationId,
        projectId,
        requestedByUserId: userId,
      }),
    )
  })

  it("rejects an invalid URL with 422", async () => {
    await createContext()

    const response = await subject({ url: "not-a-valid-url" })

    expectResponse(response, 422, "Invalid URL.")
    expect(doclingCrawlingBatchServiceMock.enqueueCrawlUrl).not.toHaveBeenCalled()
  })

  it.each([
    ["a loopback address", "http://127.0.0.1/"],
    ["the cloud metadata address", "http://169.254.169.254/"],
    ["an IPv6 loopback address", "http://[::1]/"],
    ["a non-http(s) scheme", "file:///etc/passwd"],
  ])("rejects a crawl target that is %s with 422", async (_label, url) => {
    await createContext()

    const response = await subject({ url })

    expectResponse(response, 422, "Invalid URL.")
    expect(doclingCrawlingBatchServiceMock.enqueueCrawlUrl).not.toHaveBeenCalled()
  })
})
