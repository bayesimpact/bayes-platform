import { randomUUID } from "node:crypto"
import { EvalExtractionDatasetsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
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

describe("Evaluation extraction datasets - confirmFile", () => {
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
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
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

  const createPendingFile = async () => {
    const { organization, project } = await createContext()
    return repositories.evaluationExtractionDatasetDocumentRepository.save(
      evaluationExtractionDatasetDocumentFactory
        .transient({ organization, project })
        .build({ fileName: "dataset.csv", uploadStatus: "pending" }),
    )
  }

  const subject = (documentId: string) =>
    request({
      route: EvalExtractionDatasetsRoutes.confirmFile,
      pathParams: { organizationId, projectId, documentId },
      token: "token",
    })

  it("marks the file as uploaded, answers it and records the activity", async () => {
    const pendingFile = await createPendingFile()

    const response = await subject(pendingFile.id)

    expectSchemaResponse(EvalExtractionDatasetsRoutes.confirmFile, response, 201)
    expect(response.body.data).toStrictEqual({
      id: pendingFile.id,
      fileName: "dataset.csv",
      size: pendingFile.size,
      mimeType: "text/csv",
      createdAt: pendingFile.createdAt.getTime(),
      updatedAt: expect.any(Number),
    })
    const file = await repositories.evaluationExtractionDatasetDocumentRepository.findOneByOrFail({
      id: pendingFile.id,
    })
    expect(file.uploadStatus).toBe("uploaded")
    await expectActivityCreated("evaluationExtractionDatasetDocument.create", {
      organizationId,
      projectId,
    })
  })

  it("answers 404 for an unknown file", async () => {
    await createPendingFile()
    expectResponse(await subject(randomUUID()), 404)
  })
})
