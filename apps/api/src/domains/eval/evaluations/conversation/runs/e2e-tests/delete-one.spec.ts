import { randomUUID } from "node:crypto"
import { EvalConversationRunsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createRunWithConversationDataset } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
import { evaluationConversationRunRecordFactory } from "@/domains/evaluations/conversation/runs/records/evaluation-conversation-run-record.factory"
import {
  createOrganizationWithAgent,
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

describe("Evaluation conversation runs - deleteOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
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

  it("deletes the run with its records and records the activity", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: "conversation" },
      },
    )
    const { run, datasetRecords } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    await repositories.evaluationConversationRunRecordRepository.save(
      datasetRecords.map((datasetRecord) =>
        evaluationConversationRunRecordFactory
          .transient({
            organization,
            project,
            evaluationConversationRun: run,
            evaluationConversationDatasetRecord: datasetRecord,
          })
          .build({ status: "graded", output: "An answer", score: 5 }),
      ),
    )
    organizationId = organization.id
    projectId = project.id
    evaluationConversationRunId = run.id

    const response = await request({
      route: EvalConversationRunsRoutes.deleteOne,
      pathParams: { organizationId, projectId, evaluationConversationRunId },
      token: "token",
    })

    expectSchemaResponse(EvalConversationRunsRoutes.deleteOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(
      await repositories.evaluationConversationRunRepository.findOneBy({ id: run.id }),
    ).toBeNull()
    expect(await repositories.evaluationConversationRunRecordRepository.count()).toBe(0)
    await expectActivityCreated("evaluationConversationRun.delete", { organizationId, projectId })
  })
})
