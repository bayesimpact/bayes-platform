import { randomUUID } from "node:crypto"
import { EvalConversationDatasetsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { evaluationConversationDatasetFactory } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.factory"
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

describe("Evaluation conversation datasets - renameOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let datasetId: string
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
    const dataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory
        .transient({ organization, project })
        .build({ name: "Product questions" }),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
  }

  const subject = (name: string) =>
    request({
      route: EvalConversationDatasetsRoutes.renameOne,
      pathParams: { organizationId, projectId, datasetId },
      body: { payload: { name } },
      token: "token",
    })

  it("renames the dataset and records the activity", async () => {
    await createContext()

    const response = await subject("Pricing questions")

    expectSchemaResponse(EvalConversationDatasetsRoutes.renameOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    const dataset = await repositories.evaluationConversationDatasetRepository.findOneByOrFail({
      id: datasetId,
    })
    expect(dataset.name).toBe("Pricing questions")
    await expectActivityCreated("evaluationConversationDataset.rename", {
      organizationId,
      projectId,
    })
  })

  // The old endpoint answered 422 for a blank name: the schema now refuses it.
  it("answers 400 for a blank name and keeps the name", async () => {
    await createContext()

    expectResponse(await subject("   "), 400)
    const dataset = await repositories.evaluationConversationDatasetRepository.findOneByOrFail({
      id: datasetId,
    })
    expect(dataset.name).toBe("Product questions")
  })
})
