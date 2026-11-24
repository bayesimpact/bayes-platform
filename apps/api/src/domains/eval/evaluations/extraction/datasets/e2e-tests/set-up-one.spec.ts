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
import {
  SIMPLE_CSV_COLUMNS,
  SIMPLE_CSV_CONTENT,
  SIMPLE_CSV_ROWS,
} from "@/domains/evaluations/extraction/runs/e2e-tests/csv-dataset.helpers"
import {
  createOrganizationWithProject,
  OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
} from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
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
  save: jest.fn(),
  getTemporaryUrl: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("Evaluation extraction datasets - setUpOne", () => {
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
    mockFileStorageService.readFile.mockResolvedValue(Buffer.from(SIMPLE_CSV_CONTENT))
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

  const createDatasetAndFile = async () => {
    const { organization, project } = await createContext()
    const dataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project }).build(),
    )
    const file = await repositories.evaluationExtractionDatasetDocumentRepository.save(
      evaluationExtractionDatasetDocumentFactory.transient({ organization, project }).build(),
    )
    return { organization, project, dataset, file }
  }

  const subject = (params: { datasetId: string; documentId: string }, payload: unknown) =>
    request({
      route: EvalExtractionDatasetsRoutes.setUpOne,
      pathParams: { organizationId, projectId, ...params },
      body: { payload },
      token: "token",
    })

  it("names the dataset, maps its columns, builds its records and records the activity", async () => {
    const { dataset, file } = await createDatasetAndFile()

    const response = await subject(
      { datasetId: dataset.id, documentId: file.id },
      { name: "Product records", columns: SIMPLE_CSV_COLUMNS },
    )

    expectSchemaResponse(EvalExtractionDatasetsRoutes.setUpOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    const updated = await repositories.evaluationExtractionDatasetRepository.findOneByOrFail({
      id: dataset.id,
    })
    expect(updated).toMatchObject({
      name: "Product records",
      evaluationExtractionDatasetDocumentId: file.id,
    })
    expect(Object.keys(updated.schemaMapping).sort()).toEqual(["col-answer", "col-question"])
    const records = await repositories.evaluationExtractionDatasetRecordRepository.findBy({
      evaluationExtractionDatasetId: dataset.id,
    })
    expect(records.map((record) => record.data)).toEqual(expect.arrayContaining(SIMPLE_CSV_ROWS))
    expect(records).toHaveLength(SIMPLE_CSV_ROWS.length)
    await expectActivityCreated("evaluationExtractionDataset.update", { organizationId, projectId })
  })

  it("answers 404 for a file of another project and changes nothing", async () => {
    const { organization, dataset } = await createDatasetAndFile()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const otherFile = await repositories.evaluationExtractionDatasetDocumentRepository.save(
      evaluationExtractionDatasetDocumentFactory
        .transient({ organization, project: otherProject })
        .build(),
    )

    const response = await subject(
      { datasetId: dataset.id, documentId: otherFile.id },
      { name: "Product records", columns: SIMPLE_CSV_COLUMNS },
    )

    expectResponse(response, 404)
    const unchanged = await repositories.evaluationExtractionDatasetRepository.findOneByOrFail({
      id: dataset.id,
    })
    expect(unchanged.name).toBe(dataset.name)
    expect(await repositories.evaluationExtractionDatasetRecordRepository.count()).toBe(0)
  })

  // The old endpoint answered 422 for a blank name and accepted a list without column: the
  // schema now refuses both.
  it("answers 400 for a blank name, and for no column", async () => {
    const { dataset, file } = await createDatasetAndFile()
    const params = { datasetId: dataset.id, documentId: file.id }

    expectResponse(await subject(params, { name: "   ", columns: SIMPLE_CSV_COLUMNS }), 400)
    expectResponse(await subject(params, { name: "Product records", columns: [] }), 400)
  })

  it("answers 400 for a column role the API does not know", async () => {
    const { dataset, file } = await createDatasetAndFile()

    const response = await subject(
      { datasetId: dataset.id, documentId: file.id },
      { name: "Product records", columns: [{ ...SIMPLE_CSV_COLUMNS[0], role: "other" }] },
    )

    expectResponse(response, 400)
  })
})
