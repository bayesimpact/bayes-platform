import { EvaluationConversationDatasetsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
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
import { EvaluationConversationDataset } from "../evaluation-conversation-dataset.entity"

describe("EvaluationConversationDatasets - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationConversationDataset>
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationConversationDataset)
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
    return { organization, project }
  }

  const subject = async (payload?: typeof EvaluationConversationDatasetsRoutes.createOne.request) =>
    request({
      route: EvaluationConversationDatasetsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should create a dataset with valid name", async () => {
    await createContext()

    const res = await subject({ payload: { name: "My Test Dataset" } })

    expectResponse(res, 201)
    expect(res.body.data).toMatchObject({ success: true })

    const datasets = await datasetRepository.find()
    expect(datasets).toHaveLength(1)
    expect(datasets[0]!.name).toBe("My Test Dataset")
    await expectActivityCreated("evaluationConversationDataset.create")
  })

  it("should reject an empty name", async () => {
    await createContext()

    const res = await subject({ payload: { name: "   " } })

    expectResponse(res, 422)
  })

  it("should create a dataset scoped to the project", async () => {
    await createContext()

    await subject({ payload: { name: "Dataset A" } })

    const datasets = await datasetRepository.find()
    expect(datasets).toHaveLength(1)
    expect(datasets[0]!.organizationId).toBe(organizationId)
    expect(datasets[0]!.projectId).toBe(projectId)
  })
})
