import { randomUUID } from "node:crypto"
import { EvaluationExtractionDatasetsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { evaluationExtractionDatasetFactory } from "../evaluation-extraction-dataset.factory"
import { evaluationExtractionDatasetDocumentFactory } from "../evaluation-extraction-dataset-document.factory"
import { evaluationExtractionDatasetRecordFactory } from "../records/evaluation-extraction-dataset-record.factory"

const mockFileStorageService = {
  readFile: jest.fn(),
  createReadStream: jest.fn(),
  save: jest.fn(),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  getTemporaryUrl: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("EvaluationExtractionDatasets - deleteFile", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
    jest.clearAllMocks()
    mockFileStorageService.deleteFile.mockResolvedValue(undefined)
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

    const document = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build()
    await repositories.evaluationExtractionDatasetDocumentRepository.save(document)
    documentId = document.id

    return { organization, project, document }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionDatasetsRoutes.deleteFile,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
    })

  it("should delete the file row and the stored file", async () => {
    const { document } = await createContext()

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toMatchObject({ success: true })
    expect(
      await repositories.evaluationExtractionDatasetDocumentRepository.findOneBy({
        id: documentId,
      }),
    ).toBeNull()
    expect(mockFileStorageService.deleteFile).toHaveBeenCalledWith(document.storageRelativePath)
    await expectActivityCreated("evaluationExtractionDatasetDocument.delete")
  })

  it("should keep datasets built from the file and unlink them", async () => {
    const { organization, project } = await createContext()
    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ evaluationExtractionDatasetDocumentId: documentId })
    await repositories.evaluationExtractionDatasetRepository.save(dataset)
    const records = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .buildList(2)
    await repositories.evaluationExtractionDatasetRecordRepository.save(records)

    expectResponse(await subject())

    const remainingDataset = await repositories.evaluationExtractionDatasetRepository.findOneBy({
      id: dataset.id,
    })
    expect(remainingDataset).not.toBeNull()
    expect(remainingDataset!.evaluationExtractionDatasetDocumentId).toBeNull()
    expect(
      await repositories.evaluationExtractionDatasetRecordRepository.countBy({
        evaluationExtractionDatasetId: dataset.id,
      }),
    ).toBe(2)
  })

  it("should still delete the row when the stored file cannot be removed", async () => {
    await createContext()
    mockFileStorageService.deleteFile.mockRejectedValueOnce(new Error("storage unavailable"))

    expectResponse(await subject())

    expect(
      await repositories.evaluationExtractionDatasetDocumentRepository.findOneBy({
        id: documentId,
      }),
    ).toBeNull()
  })

  it("should return 404 for an unknown file", async () => {
    await createContext()
    documentId = randomUUID()

    expectResponse(await subject(), 404)
  })
})
