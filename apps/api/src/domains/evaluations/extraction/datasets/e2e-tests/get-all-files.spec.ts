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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { evaluationExtractionDatasetDocumentFactory } from "../evaluation-extraction-dataset-document.factory"

describe("EvaluationExtractionDatasets - getAllFiles", () => {
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
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
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

  const subject = async () =>
    request({
      route: EvaluationExtractionDatasetsRoutes.getAllFiles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("should return an empty list when no dataset files exist", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toEqual([])
  })

  it("should return the uploaded dataset files", async () => {
    const { organization, project } = await createContext()

    const datasetFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build({ fileName: "dataset.csv" })
    await repositories.evaluationExtractionDatasetDocumentRepository.save(datasetFile)

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: datasetFile.id,
      fileName: "dataset.csv",
      projectId,
    })
  })

  it("should not return files whose upload was never confirmed", async () => {
    const { organization, project } = await createContext()

    const pendingFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build({ fileName: "pending.csv", uploadStatus: "pending" })
    const uploadedFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build({ fileName: "dataset.csv" })
    await repositories.evaluationExtractionDatasetDocumentRepository.save([
      pendingFile,
      uploadedFile,
    ])

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]!.fileName).toBe("dataset.csv")
  })

  it("should not return files of another project", async () => {
    const { organization, project } = await createContext()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )

    const foreignFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project: otherProject })
      .build({ fileName: "foreign.csv" })
    const ownFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build({ fileName: "dataset.csv" })
    await repositories.evaluationExtractionDatasetDocumentRepository.save([foreignFile, ownFile])

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]!.fileName).toBe("dataset.csv")
  })

  it("should return files newest first", async () => {
    const { organization, project } = await createContext()

    const olderFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build({ fileName: "older.csv", createdAt: new Date("2024-01-01") })
    const newerFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build({ fileName: "newer.csv", createdAt: new Date("2024-06-01") })
    await repositories.evaluationExtractionDatasetDocumentRepository.save([olderFile, newerFile])

    const res = await subject()

    expectResponse(res)
    expect(res.body.data.map((file: { fileName: string }) => file.fileName)).toEqual([
      "newer.csv",
      "older.csv",
    ])
  })

  it("should return files with all required fields", async () => {
    const { organization, project } = await createContext()

    const datasetFile = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build()
    await repositories.evaluationExtractionDatasetDocumentRepository.save(datasetFile)

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toEqual({
      id: datasetFile.id,
      fileName: datasetFile.fileName,
      mimeType: "text/csv",
      projectId,
      size: datasetFile.size,
      storageRelativePath: datasetFile.storageRelativePath,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    })
  })
})
