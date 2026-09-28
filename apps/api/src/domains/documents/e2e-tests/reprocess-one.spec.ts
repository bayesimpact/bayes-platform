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
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import {
  DOCUMENT_EMBEDDINGS_BATCH_SERVICE,
  type DocumentEmbeddingsBatchService,
} from "../embeddings/document-embeddings-batch.interface"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - reprocessOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let userId: string
  let embeddingsBatchServiceMock: {
    enqueueCreateEmbeddingsForDocument: jest.MockedFunction<
      DocumentEmbeddingsBatchService["enqueueCreateEmbeddingsForDocument"]
    >
  }

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    embeddingsBatchServiceMock = setup.module.get(DOCUMENT_EMBEDDINGS_BATCH_SERVICE)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    embeddingsBatchServiceMock.enqueueCreateEmbeddingsForDocument.mockClear()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (overrides?: {
    embeddingStatus?: "failed" | "completed"
    sourceType?: "project" | "extraction"
  }) => {
    const { user, organization, project, document } = await createOrganizationWithDocument(
      repositories,
      {
        user: { auth0Id },
        document: {
          embeddingStatus: overrides?.embeddingStatus ?? "failed",
          sourceType: overrides?.sourceType ?? "project",
        },
      },
    )
    userId = user.id
    organizationId = organization.id
    projectId = project.id
    documentId = document.id
  }

  const subject = async () =>
    request({
      route: DocumentsRoutes.reprocessOne,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
    })

  it("reprocesses a failed project document", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data.success).toBe(true)
    expect(embeddingsBatchServiceMock.enqueueCreateEmbeddingsForDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId,
        organizationId,
        projectId,
        uploadedByUserId: userId,
        origin: "document-upload",
      }),
    )
  })

  it("rejects when document is not failed", async () => {
    await createContext({ embeddingStatus: "completed" })

    const response = await subject()

    expectResponse(response, 422, "Only failed documents can be reprocessed.")
    expect(embeddingsBatchServiceMock.enqueueCreateEmbeddingsForDocument).not.toHaveBeenCalled()
  })

  it("rejects when document source type is not project", async () => {
    await createContext({ sourceType: "extraction" })

    const response = await subject()

    expectResponse(response, 422, "Only project documents can be reprocessed.")
    expect(embeddingsBatchServiceMock.enqueueCreateEmbeddingsForDocument).not.toHaveBeenCalled()
  })
})
