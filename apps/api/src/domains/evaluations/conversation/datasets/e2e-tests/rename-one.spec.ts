import { EvaluationConversationDatasetsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationDataset } from "../evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../evaluation-conversation-dataset.factory"

describe("EvaluationConversationDatasets - renameOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationConversationDataset>

  let organizationId: string
  let projectId: string
  let datasetId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationConversationDataset)
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

    const dataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build()
    await datasetRepository.save(dataset)
    datasetId = dataset.id

    return { organization, project, dataset }
  }

  const subject = async (payload?: typeof EvaluationConversationDatasetsRoutes.renameOne.request) =>
    request({
      route: EvaluationConversationDatasetsRoutes.renameOne,
      pathParams: removeNullish({ organizationId, projectId, datasetId }),
      token: accessToken,
      request: payload,
    })

  it("should rename the dataset", async () => {
    await createContext()

    const res = await subject({ payload: { name: "Renamed Dataset" } })

    expectResponse(res)
    expect(res.body.data).toMatchObject({ success: true })

    const updatedDataset = await datasetRepository.findOneBy({ id: datasetId })
    expect(updatedDataset!.name).toBe("Renamed Dataset")
  })

  it("should reject an empty name", async () => {
    await createContext()

    const res = await subject({ payload: { name: "   " } })

    expectResponse(res, 422)
  })
})
