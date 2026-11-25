import { randomUUID } from "node:crypto"
import { EvalExtractionDatasetsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { evaluationExtractionDatasetFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.factory"
import { evaluationExtractionDatasetDocumentFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.factory"
import { evaluationExtractionDatasetRecordFactory } from "@/domains/evaluations/extraction/datasets/records/evaluation-extraction-dataset-record.factory"
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

const mockFileStorageService = {
  readFile: jest.fn(),
  createReadStream: jest.fn(),
  save: jest.fn(),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  getTemporaryUrl: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("Evaluation extraction datasets - deleteFile", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

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
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
    jest.clearAllMocks()
    mockFileStorageService.deleteFile.mockResolvedValue(undefined)
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

  const createFile = async () => {
    const { organization, project } = await createContext()
    const file = await repositories.evaluationExtractionDatasetDocumentRepository.save(
      evaluationExtractionDatasetDocumentFactory.transient({ organization, project }).build(),
    )
    return { organization, project, file }
  }

  const subject = (documentId: string) =>
    request({
      route: EvalExtractionDatasetsRoutes.deleteFile,
      pathParams: { organizationId, projectId, documentId },
      token: "token",
    })

  it("deletes the file and the stored bytes, and records the activity", async () => {
    const { file } = await createFile()

    const response = await subject(file.id)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.deleteFile, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(await repositories.evaluationExtractionDatasetDocumentRepository.count()).toBe(0)
    expect(mockFileStorageService.deleteFile).toHaveBeenCalledWith(file.storageRelativePath)
    await expectActivityCreated("evaluationExtractionDatasetDocument.delete", {
      organizationId,
      projectId,
    })
  })

  it("keeps the datasets built from the file and unlinks them", async () => {
    const { organization, project, file } = await createFile()
    const dataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory
        .transient({ organization, project })
        .build({ evaluationExtractionDatasetDocumentId: file.id }),
    )
    await repositories.evaluationExtractionDatasetRecordRepository.save(
      evaluationExtractionDatasetRecordFactory
        .transient({ organization, project, evaluationExtractionDataset: dataset })
        .buildList(2),
    )

    expectResponse(await subject(file.id), 200)

    const remaining = await repositories.evaluationExtractionDatasetRepository.findOneByOrFail({
      id: dataset.id,
    })
    expect(remaining.evaluationExtractionDatasetDocumentId).toBeNull()
    expect(await repositories.evaluationExtractionDatasetRecordRepository.count()).toBe(2)
  })

  it("still deletes the file when the stored bytes cannot be removed", async () => {
    const { file } = await createFile()
    mockFileStorageService.deleteFile.mockRejectedValueOnce(new Error("The storage is down"))

    expectResponse(await subject(file.id), 200)

    expect(await repositories.evaluationExtractionDatasetDocumentRepository.count()).toBe(0)
  })

  it("answers 404 for an unknown file", async () => {
    await createFile()
    expectResponse(await subject(randomUUID()), 404)
  })
})
