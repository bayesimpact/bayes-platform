import { AgentModel, EvaluationConversationRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationDataset } from "../../datasets/evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../../datasets/evaluation-conversation-dataset.factory"
import { EvaluationConversationDatasetRecord } from "../../datasets/records/evaluation-conversation-dataset-record.entity"
import { evaluationConversationDatasetRecordFactory } from "../../datasets/records/evaluation-conversation-dataset-record.factory"
import { EvaluationConversationRun } from "../evaluation-conversation-run.entity"
import { evaluationConversationRunFactory } from "../evaluation-conversation-run.factory"
import { EvaluationConversationRunRecord } from "../records/evaluation-conversation-run-record.entity"
import { evaluationConversationRunRecordFactory } from "../records/evaluation-conversation-run-record.factory"

describe("EvaluationConversationRuns - getRecords", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
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
        agentSettings: { model: AgentModel._Mock },
      },
    )
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const dataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build()
    await setup.getRepository(EvaluationConversationDataset).save(dataset)

    const datasetRecord = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input: "What is 1+1?", expectedOutput: "2" })
    await setup.getRepository(EvaluationConversationDatasetRecord).save(datasetRecord)

    const run = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build({ status: "completed" })
    await setup.getRepository(EvaluationConversationRun).save(run)
    evaluationConversationRunId = run.id

    const runRecord = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: datasetRecord,
      })
      .build({
        status: "graded",
        output: "The answer is 2",
        score: 90,
        traceId: "trace-1",
      })
    await setup.getRepository(EvaluationConversationRunRecord).save(runRecord)

    return { organization, project, dataset, datasetRecord, agent, agentSettings, run, runRecord }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationRunsRoutes.getRecords,
      pathParams: removeNullish({ organizationId, projectId, evaluationConversationRunId }),
      token: accessToken,
    })

  it("should return records for the evaluation run", async () => {
    const { runRecord } = await createContext()

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.records).toHaveLength(1)
    expect(res.body.data.records[0]!.id).toBe(runRecord.id)
    expect(res.body.data.records[0]!.status).toBe("graded")
    expect(res.body.data.records[0]!.input).toBe("What is 1+1?")
    expect(res.body.data.records[0]!.expectedOutput).toBe("2")
    expect(res.body.data.records[0]!.output).toBe("The answer is 2")
    expect(res.body.data.records[0]!.score).toBe(90)
    expect(res.body.data.records[0]!.traceUrl).toEqual(expect.any(String))
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.page).toBe(0)
    expect(res.body.data.limit).toBe(10)
  })

  it("should return empty list when no records exist", async () => {
    const { organization, project, dataset, agent, agentSettings } = await createContext()

    const emptyRun = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build()
    await setup.getRepository(EvaluationConversationRun).save(emptyRun)
    evaluationConversationRunId = emptyRun.id

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.records).toEqual([])
    expect(res.body.data.total).toBe(0)
  })
})
