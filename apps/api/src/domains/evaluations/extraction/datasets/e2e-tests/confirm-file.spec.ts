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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { evaluationExtractionDatasetDocumentFactory } from "../evaluation-extraction-dataset-document.factory"

describe("EvaluationExtractionDatasets - confirmFile", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const pendingDocument = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build({ fileName: "dataset.csv", uploadStatus: "pending" })
    await repositories.evaluationExtractionDatasetDocumentRepository.save(pendingDocument)
    documentId = pendingDocument.id

    return { organization, project, pendingDocument }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionDatasetsRoutes.confirmFile,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
    })

  it("should mark the file as uploaded and return it", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res, 201)
    expect(res.body.data).toMatchObject({
      id: documentId,
      fileName: "dataset.csv",
      mimeType: "text/csv",
      projectId,
    })

    const document = await repositories.evaluationExtractionDatasetDocumentRepository.findOneBy({
      id: documentId,
    })
    expect(document!.uploadStatus).toBe("uploaded")
    await expectActivityCreated("evaluationExtractionDatasetDocument.create")
  })

  it("should list the file once confirmed", async () => {
    await createContext()

    expectResponse(await subject(), 201)

    const listResponse = await request({
      route: EvaluationExtractionDatasetsRoutes.getAllFiles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })
    expectResponse(listResponse)
    expect(listResponse.body.data).toHaveLength(1)
    expect(listResponse.body.data[0]!.id).toBe(documentId)
  })

  it("should return 404 for an unknown file", async () => {
    await createContext()
    documentId = randomUUID()

    expectResponse(await subject(), 404)
  })
})
