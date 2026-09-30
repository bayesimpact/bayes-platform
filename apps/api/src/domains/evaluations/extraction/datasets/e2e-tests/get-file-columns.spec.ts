import { Readable } from "node:stream"
import { EvaluationExtractionDatasetsRoutes } from "@caseai-connect/api-contracts"
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
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { evaluationExtractionDatasetDocumentFactory } from "../evaluation-extraction-dataset-document.factory"

const CSV_CONTENT = "name,age,city\nAlice,30,Paris\nBob,25,London\nCharlie,35,Berlin"

const mockFileStorageService = {
  readFile: jest.fn().mockResolvedValue(Buffer.from(CSV_CONTENT)),
  createReadStream: jest.fn().mockImplementation(() => Readable.from(Buffer.from(CSV_CONTENT))),
  save: jest.fn(),
  getTemporaryUrl: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("EvaluationExtractionDatasets - getFileColumns", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
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
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
    mockFileStorageService.readFile.mockResolvedValue(Buffer.from(CSV_CONTENT))
    mockFileStorageService.createReadStream.mockImplementation(() =>
      Readable.from(Buffer.from(CSV_CONTENT)),
    )
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
      .build({ fileName: "dataset.csv" })
    await repositories.evaluationExtractionDatasetDocumentRepository.save(document)
    documentId = document.id

    return { organization, project, document }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionDatasetsRoutes.getFileColumns,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
    })

  it("should return columns from a CSV file", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(3)

    const columnNames = res.body.data.map((column: { name: string }) => column.name)
    expect(columnNames).toContain("name")
    expect(columnNames).toContain("age")
    expect(columnNames).toContain("city")
  })

  it("should return column values as preview", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    const nameColumn = res.body.data.find((column: { name: string }) => column.name === "name")
    expect(nameColumn).toBeDefined()
    expect(nameColumn!.values).toContain("Alice")
    expect(nameColumn!.values).toContain("Bob")
    expect(nameColumn!.values).toContain("Charlie")
  })

  it("should return columns with all required fields", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    for (const column of res.body.data) {
      expect(column).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        values: expect.any(Array),
      })
    }
  })

  it("should standardize null-like values", async () => {
    const nullContent = "col1,col2\nN/A,real\nNaN,data\n,value"
    mockFileStorageService.readFile.mockResolvedValue(Buffer.from(nullContent))
    mockFileStorageService.createReadStream.mockImplementation(() =>
      Readable.from(Buffer.from(nullContent)),
    )
    await createContext()

    const res = await subject()

    expectResponse(res)
    const col1 = res.body.data.find((column: { name: string }) => column.name === "col1")
    expect(col1!.values).toEqual(["null", "null", "null"])
  })
})
