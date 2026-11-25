import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
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
import { evaluationExtractionDatasetDocumentFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.factory"
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

const CSV_CONTENT = "name,age,city\nAlice,30,Paris\nBob,25,London\nCharlie,35,Berlin"

const mockFileStorageService = {
  readFile: jest.fn(),
  createReadStream: jest.fn(),
  save: jest.fn(),
  getTemporaryUrl: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("Evaluation extraction datasets - getFileColumns", () => {
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
    mockFileStorageService.readFile.mockResolvedValue(Buffer.from(CSV_CONTENT))
    mockFileStorageService.createReadStream.mockImplementation(() =>
      Readable.from(Buffer.from(CSV_CONTENT)),
    )
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
    return repositories.evaluationExtractionDatasetDocumentRepository.save(
      evaluationExtractionDatasetDocumentFactory.transient({ organization, project }).build(),
    )
  }

  const subject = (documentId: string) =>
    request({
      route: EvalExtractionDatasetsRoutes.getFileColumns,
      pathParams: { organizationId, projectId, documentId },
      token: "token",
    })

  it("returns the columns of the CSV with their first values", async () => {
    const file = await createFile()

    const response = await subject(file.id)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getFileColumns, response)
    expect(response.body.data.map((column) => column.name)).toEqual(["name", "age", "city"])
    expect(response.body.data[0]?.values).toEqual(["Alice", "Bob", "Charlie"])
    for (const column of response.body.data) expect(column.id).toEqual(expect.any(String))
  })

  it("standardizes the null-like values", async () => {
    const nullContent = "col1,col2\nN/A,real\nNaN,data\n,value"
    mockFileStorageService.readFile.mockResolvedValue(Buffer.from(nullContent))
    mockFileStorageService.createReadStream.mockImplementation(() =>
      Readable.from(Buffer.from(nullContent)),
    )
    const file = await createFile()

    const response = await subject(file.id)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getFileColumns, response)
    expect(response.body.data.find((column) => column.name === "col1")?.values).toEqual([
      "null",
      "null",
      "null",
    ])
  })

  const storeCsvContent = (csvContent: string) => {
    mockFileStorageService.readFile.mockResolvedValue(Buffer.from(csvContent))
    mockFileStorageService.createReadStream.mockImplementation(() =>
      Readable.from(Buffer.from(csvContent)),
    )
  }

  it.each([
    ["with no final newline", "name,age,city"],
    ["with a final newline", "name,age,city\n"],
  ])("returns the columns of a file with a header and no data row, %s", async (_case, csvContent) => {
    storeCsvContent(csvContent)
    const file = await createFile()

    const response = await subject(file.id)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getFileColumns, response)
    expect(
      response.body.data.map((column) => ({ name: column.name, values: column.values })),
    ).toEqual([
      { name: "name", values: [] },
      { name: "age", values: [] },
      { name: "city", values: [] },
    ])
  })

  it("keeps the first rows' values of a file with more rows than the preview", async () => {
    storeCsvContent("name,age\nrow1,1\nrow2,2\nrow3,3\nrow4,4\nrow5,5\nrow6,6\nrow7,7")
    const file = await createFile()

    const response = await subject(file.id)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.getFileColumns, response)
    expect(response.body.data.find((column) => column.name === "name")?.values).toEqual([
      "row1",
      "row2",
      "row3",
      "row4",
      "row5",
    ])
  })

  it.each([
    ["an empty file", ""],
    ["a file of blank lines", "\n\n\n"],
  ])("answers 422 for %s", async (_case, csvContent) => {
    storeCsvContent(csvContent)
    const file = await createFile()

    expectResponse(await subject(file.id), 422, "CSV file has no columns")
  })

  it("answers 404 for an unknown file", async () => {
    await createFile()
    expectResponse(await subject(randomUUID()), 404)
  })
})
