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
import { evaluationConversationDatasetRecordFactory } from "@/domains/evaluations/conversation/datasets/records/evaluation-conversation-dataset-record.factory"
import { createRunWithConversationDataset } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
  OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

describe("Evaluation conversation datasets - deleteOne", () => {
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

  const subject = () =>
    request({
      route: EvalConversationDatasetsRoutes.deleteOne,
      pathParams: { organizationId, projectId, datasetId },
      token: "token",
    })

  it("deletes the dataset with its records and records the activity", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
    })
    const dataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    await repositories.evaluationConversationDatasetRecordRepository.save(
      evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: dataset })
        .buildList(3),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id

    const response = await subject()

    expectSchemaResponse(EvalConversationDatasetsRoutes.deleteOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(
      await repositories.evaluationConversationDatasetRepository.findOneBy({ id: datasetId }),
    ).toBeNull()
    expect(await repositories.evaluationConversationDatasetRecordRepository.count()).toBe(0)
    await expectActivityCreated("evaluationConversationDataset.delete", {
      organizationId,
      projectId,
    })
  })

  it("deletes the runs of the dataset", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: "conversation" },
      },
    )
    const { dataset } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id

    expectSchemaResponse(EvalConversationDatasetsRoutes.deleteOne, await subject())

    expect(await repositories.evaluationConversationRunRepository.count()).toBe(0)
  })
})
