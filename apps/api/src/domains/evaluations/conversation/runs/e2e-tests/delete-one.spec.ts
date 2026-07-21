import { EvaluationConversationRunsRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationRun } from "../evaluation-conversation-run.entity"
import { EvaluationConversationRunRecord } from "../records/evaluation-conversation-run-record.entity"
import { evaluationConversationRunRecordFactory } from "../records/evaluation-conversation-run-record.factory"
import { createRunWithConversationDataset } from "./conversation-dataset.helpers"

describe("EvaluationConversationRuns - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
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
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "conversation" },
      },
    )
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const { dataset, datasetRecords, run } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    evaluationConversationRunId = run.id
    return { organization, project, run, dataset, datasetRecords, agent }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationRunsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationConversationRunId }),
      token: accessToken,
    })

  it("deletes the run and returns success", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.success).toBe(true)

    const run = await setup
      .getRepository(EvaluationConversationRun)
      .findOneBy({ id: evaluationConversationRunId })
    expect(run).toBeNull()

    await expectActivityCreated("evaluationConversationRun.delete")
  })

  it("cascades delete to run records", async () => {
    const { organization, project, run, datasetRecords } = await createContext()

    const runRecord = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: datasetRecords[0],
      })
      .build({ status: "graded", output: "answer", score: 5 })
    await setup.getRepository(EvaluationConversationRunRecord).save(runRecord)

    const recordsBefore = await setup
      .getRepository(EvaluationConversationRunRecord)
      .findBy({ evaluationConversationRunId })
    expect(recordsBefore.length).toBeGreaterThan(0)

    await subject()

    const recordsAfter = await setup
      .getRepository(EvaluationConversationRunRecord)
      .findBy({ evaluationConversationRunId })
    expect(recordsAfter).toHaveLength(0)
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    evaluationConversationRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject()

    expectResponse(res, 404)
  })
})
