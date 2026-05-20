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
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { DocumentsModule } from "../../documents.module"
import { DocumentEmbeddingStatusNotifierService } from "../../embeddings/document-embedding-status-notifier.service"
import { withCrawlingAndAuthMocks } from "../../test-overrides"
import {
  URL_CRAWLING_BATCH_SERVICE,
  type UrlCrawlingBatchService,
} from "../url-crawling-batch.interface"

describe("Documents - reCrawlUrl", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let crawlingBatchServiceMock: {
    enqueueCrawlUrl: jest.MockedFunction<UrlCrawlingBatchService["enqueueCrawlUrl"]>
  }
  let notifierMock: {
    notifyEmbeddingStatusChanged: jest.MockedFunction<
      DocumentEmbeddingStatusNotifierService["notifyEmbeddingStatusChanged"]
    >
  }

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) => withCrawlingAndAuthMocks(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    crawlingBatchServiceMock = setup.module.get(URL_CRAWLING_BATCH_SERVICE)
    notifierMock = setup.module.get(DocumentEmbeddingStatusNotifierService)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    crawlingBatchServiceMock.enqueueCrawlUrl.mockClear()
    notifierMock.notifyEmbeddingStatusChanged.mockClear()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (
    overrides?: Partial<{
      sourceUrl: string | null
      title: string
      content: string | null
      embeddingStatus: string
    }>,
  ) => {
    const { user, organization, project, document } = await createOrganizationWithDocument(
      repositories,
      {
        user: { auth0Id },
        document: {
          sourceType: "webCrawl",
          sourceUrl:
            overrides?.sourceUrl !== undefined ? overrides.sourceUrl : "https://example.com",
          title: overrides?.title ?? "https://example.com",
          content: overrides?.content ?? undefined,
          embeddingStatus: (overrides?.embeddingStatus as "completed") ?? "completed",
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    documentId = document.id
    return { user, organization, project, document }
  }

  const subject = async () =>
    request({
      route: DocumentsRoutes.reCrawlUrl,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
    })

  it("resets the document and re-enqueues the crawl job using sourceUrl", async () => {
    await createContext({ sourceUrl: "https://example.com" })

    const response = await subject()

    expectResponse(response, 202)
    expect(response.body.data.message).toContain("https://example.com")

    const document = await repositories.documentRepository.findOne({ where: { id: documentId } })
    expect(document?.embeddingStatus).toBe("pending")
    expect(document?.content).toBeNull()
    expect(document?.embeddingError).toBeNull()

    expect(crawlingBatchServiceMock.enqueueCrawlUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com",
        documentId,
        organizationId,
        projectId,
      }),
    )
    expect(notifierMock.notifyEmbeddingStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ documentId, embeddingStatus: "pending" }),
    )
  })


  it("rejects documents that are not webCrawl type", async () => {
    const { organization, project } = await createOrganizationWithDocument(repositories, {
      user: { auth0Id },
      document: { sourceType: "project" },
    })
    organizationId = organization.id
    projectId = project.id
    documentId = (await repositories.documentRepository.findOne({ where: { projectId } }))!.id

    const response = await subject()

    expectResponse(response, 422, "Document is not a web crawl source.")
    expect(crawlingBatchServiceMock.enqueueCrawlUrl).not.toHaveBeenCalled()
  })

  it("rejects when sourceUrl is null, title is not a URL, and content is empty", async () => {
    await createContext({ sourceUrl: null, title: "Just a name", content: null })

    const response = await subject()

    expectResponse(
      response,
      422,
      "Source URL not available for this document. Please delete it and crawl the website again.",
    )
    expect(crawlingBatchServiceMock.enqueueCrawlUrl).not.toHaveBeenCalled()
  })
})
