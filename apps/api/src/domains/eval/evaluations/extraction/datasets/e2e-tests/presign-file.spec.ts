import { randomUUID } from "node:crypto"
import { EvalExtractionDatasetsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import {
  createOrganizationWithProject,
  OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

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

describe("Evaluation extraction datasets - presignFile", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
    })
    organizationId = organization.id
    projectId = project.id
    return { organization, project }
  }

  const csvFile = { fileName: "dataset.csv", mimeType: "text/csv", size: 2048 }

  const subject = (payload: Record<string, unknown>) =>
    request({
      route: EvalExtractionDatasetsRoutes.presignFile,
      pathParams: { organizationId, projectId },
      body: { payload },
      token: "token",
    })

  it("creates a pending file and answers the signed upload URL", async () => {
    await createContext()

    const response = await subject(csvFile)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.presignFile, response, 201)
    const documents = await repositories.evaluationExtractionDatasetDocumentRepository.find()
    expect(documents).toHaveLength(1)
    expect(response.body.data).toStrictEqual({
      documentId: documents[0]?.id,
      uploadUrl: UPLOAD_URL,
    })
    expect(documents[0]).toMatchObject({
      organizationId,
      projectId,
      fileName: "dataset.csv",
      mimeType: "text/csv",
      size: 2048,
      storageRelativePath: `evaluation-extraction-datasets/${documents[0]?.id}.csv`,
      uploadStatus: "pending",
    })
    expect(mockFileStorageService.generateSignedUploadUrl).toHaveBeenCalledWith({
      storagePath: `evaluation-extraction-datasets/${documents[0]?.id}.csv`,
      mimeType: "text/csv",
      expiresInSeconds: 900,
      contentLength: 2048,
    })
  })

  // The old endpoint answered 422 for a file that is not a CSV: the schema now refuses it.
  it("answers 400 for a file that is not a CSV and creates nothing", async () => {
    await createContext()

    expectResponse(await subject({ ...csvFile, mimeType: "application/pdf" }), 400)
    expect(await repositories.evaluationExtractionDatasetDocumentRepository.count()).toBe(0)
  })

  it("answers 400 for an empty file name and a size under 1", async () => {
    await createContext()

    expectResponse(await subject({ ...csvFile, fileName: "" }), 400)
    expectResponse(await subject({ ...csvFile, size: 0 }), 400)
  })
})
