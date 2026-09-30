import { randomUUID } from "node:crypto"
import { AgentModel, EvaluationExtractionRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EVALUATION_EXTRACTION_RUN_BATCH_SERVICE } from "../evaluation-extraction-run-batch.interface"
import { EvaluationExtractionRunRecord } from "../records/evaluation-extraction-run-record.entity"
import { evaluationExtractionRunRecordFactory } from "../records/evaluation-extraction-run-record.factory"
import { createRunWithCsvDataset } from "./csv-dataset.helpers"

describe("EvaluationExtractionRuns - retryOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationExtractionRunId: string
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  const mockRetryRunRecords = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EVALUATION_EXTRACTION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: mockRetryRunRecords,
            removePendingRunRecords: jest.fn().mockResolvedValue(undefined),
          }),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockRetryRunRecords.mockClear()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A run pinned to the published settings, with one record left to retry. */
  const createContext = async () => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        agent: { type: "extraction" },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { answer: { type: "string" } } },
          model: AgentModel._Mock,
          instructions: "Published instructions",
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!

    const { datasetRecords, run } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: [{ agentOutputKey: "answer", datasetColumnId: "col-answer", mode: "scored" }],
    })
    evaluationExtractionRunId = run.id

    const [firstDatasetRecord] = datasetRecords
    if (!firstDatasetRecord) throw new Error("expected a dataset record")
    await setup.getRepository(EvaluationExtractionRunRecord).save(
      evaluationExtractionRunRecordFactory
        .transient({
          organization,
          project,
          evaluationExtractionRun: run,
          evaluationExtractionDatasetRecord: firstDatasetRecord,
        })
        .build({ status: "error" }),
    )

    return { organization, project, agent, agentSettings, run }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionRunsRoutes.retryOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
      token: accessToken,
    })

  it("retries the records with the settings version the run is pinned to", async () => {
    const { agentSettings } = await createContext()

    const res = await subject()

    expectResponse(res, 201)
    expect(mockRetryRunRecords).toHaveBeenCalledTimes(1)
    const [payloads] = mockRetryRunRecords.mock.calls[0]
    expect(payloads).toHaveLength(1)
    expect(payloads[0].agentWithSettings.settings).toMatchObject({
      revision: agentSettings.revision,
      instructions: "Published instructions",
    })
  })

  it("does not retry with a newer draft revision (#636)", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: agentSettings.revision + 1, instructions: "Draft instructions" }),
    )

    const res = await subject()

    expectResponse(res, 201)
    expect(mockRetryRunRecords).toHaveBeenCalledTimes(1)
    const [payloads] = mockRetryRunRecords.mock.calls[0]
    expect(payloads[0].agentWithSettings.settings).toMatchObject({
      revision: agentSettings.revision,
      instructions: "Published instructions",
    })
  })
})
