import { AgentModel, EvaluationExtractionRunsRoutes } from "@caseai-connect/api-contracts"
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
import { EvaluationExtractionDataset } from "../../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionDatasetRecord } from "../../datasets/records/evaluation-extraction-dataset-record.entity"
import { evaluationExtractionDatasetRecordFactory } from "../../datasets/records/evaluation-extraction-dataset-record.factory"
import { EvaluationExtractionRun } from "../evaluation-extraction-run.entity"
import { evaluationExtractionRunFactory } from "../evaluation-extraction-run.factory"
import { EvaluationExtractionRunRecord } from "../records/evaluation-extraction-run-record.entity"
import { evaluationExtractionRunRecordFactory } from "../records/evaluation-extraction-run-record.factory"

describe("EvaluationExtractionRuns - getRecords", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationExtractionRunId: string
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
        agent: { type: "extraction" },
        agentSettings: {
          outputJsonSchema: { type: "object" },
          model: AgentModel._MockGenerateStructuredOutput,
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ schemaMapping: {} })
    await setup.getRepository(EvaluationExtractionDataset).save(dataset)

    const datasetRecord = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "value1" } })
    await setup.getRepository(EvaluationExtractionDatasetRecord).save(datasetRecord)

    const run = evaluationExtractionRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationExtractionDataset: dataset,
      })
      .build({ status: "completed" })
    await setup.getRepository(EvaluationExtractionRun).save(run)
    evaluationExtractionRunId = run.id

    const runRecord = evaluationExtractionRunRecordFactory
      .transient({
        organization,
        project,
        evaluationExtractionRun: run,
        evaluationExtractionDatasetRecord: datasetRecord,
      })
      .build({
        status: "match",
        comparison: { col1: { agentValue: "value1", groundTruth: "value1", status: "match" } },
        agentRawOutput: { col1: "value1" },
      })
    await setup.getRepository(EvaluationExtractionRunRecord).save(runRecord)

    return { organization, project, dataset, datasetRecord, agent, agentSettings, run, runRecord }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionRunsRoutes.getRecords,
      pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
      token: accessToken,
    })

  it("should return records for the evaluation run", async () => {
    const { runRecord } = await createContext()

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.records).toHaveLength(1)
    expect(res.body.data.records[0]!.id).toBe(runRecord.id)
    expect(res.body.data.records[0]!.status).toBe("match")
    expect(res.body.data.records[0]!.comparison).toBeDefined()
    expect(res.body.data.records[0]!.datasetRecordData).toEqual({ col1: "value1" })
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.page).toBe(0)
    expect(res.body.data.limit).toBe(10)
  })

  it("should return empty list when no records exist", async () => {
    const { organization, project, dataset, agent, agentSettings } = await createContext()

    const emptyRun = evaluationExtractionRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationExtractionDataset: dataset,
      })
      .build()
    await setup.getRepository(EvaluationExtractionRun).save(emptyRun)
    evaluationExtractionRunId = emptyRun.id

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.records).toEqual([])
    expect(res.body.data.total).toBe(0)
  })
})
