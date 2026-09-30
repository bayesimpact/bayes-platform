import { EvaluationExtractionDatasetsRoutes, MimeTypes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"

const UPLOAD_URL = "https://storage.example.com/signed-upload-url"

const mockFileStorageService = {
  readFile: jest.fn(),
  createReadStream: jest.fn(),
  save: jest.fn(),
  deleteFile: jest.fn(),
  getTemporaryUrl: jest.fn(),
  generateSignedUploadUrl: jest.fn().mockResolvedValue(UPLOAD_URL),
  buildStorageRelativePath: jest.fn(
    ({ documentId, extension }: { documentId: string; extension: string }) =>
      `evaluation-extraction-datasets/${documentId}.${extension}`,
  ),
}

describe("EvaluationExtractionDatasets - presignFile", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    return { organization, project }
  }

  const csvFile = { fileName: "dataset.csv", mimeType: MimeTypes.csv, size: 2048 }

  const subject = async (payload?: typeof EvaluationExtractionDatasetsRoutes.presignFile.request) =>
    request({
      route: EvaluationExtractionDatasetsRoutes.presignFile,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should create a pending file and return the signed upload URL", async () => {
    await createContext()

    const res = await subject({ payload: csvFile })

    expectResponse(res, 201)
    expect(res.body.data).toEqual({ documentId: expect.any(String), uploadUrl: UPLOAD_URL })

    const document = await repositories.evaluationExtractionDatasetDocumentRepository.findOneBy({
      id: res.body.data.documentId,
    })
    expect(document).toMatchObject({
      organizationId,
      projectId,
      fileName: "dataset.csv",
      mimeType: "text/csv",
      size: 2048,
      storageRelativePath: `evaluation-extraction-datasets/${res.body.data.documentId}.csv`,
      uploadStatus: "pending",
    })
  })

  it("should sign the upload for the stored path and mime type", async () => {
    await createContext()

    const res = await subject({ payload: csvFile })

    expectResponse(res, 201)
    expect(mockFileStorageService.generateSignedUploadUrl).toHaveBeenCalledWith({
      storagePath: `evaluation-extraction-datasets/${res.body.data.documentId}.csv`,
      mimeType: "text/csv",
      expiresInSeconds: 900,
    })
  })

  it("should not list the file until the upload is confirmed", async () => {
    await createContext()

    expectResponse(await subject({ payload: csvFile }), 201)

    const listResponse = await request({
      route: EvaluationExtractionDatasetsRoutes.getAllFiles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })
    expectResponse(listResponse)
    expect(listResponse.body.data).toEqual([])
  })

  it("should reject a file that is not a CSV", async () => {
    await createContext()

    const res = await subject({
      payload: { fileName: "notes.pdf", mimeType: MimeTypes.pdf, size: 2048 },
    })

    expectResponse(res, 422)
    expect(await repositories.evaluationExtractionDatasetDocumentRepository.count()).toBe(0)
  })
})
