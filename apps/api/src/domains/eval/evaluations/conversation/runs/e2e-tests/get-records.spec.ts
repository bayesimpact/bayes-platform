import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { EvalConversationRunsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
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
import { expectResponse } from "../../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

describe("Evaluation conversation runs - getRecords", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    process.env.TRACE_URL_TEMPLATE = "https://traces.example.org/redirects/sessions/{traceId}"
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    delete process.env.TRACE_URL_TEMPLATE
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
      },
    )
    const { datasetRecords, run } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    const [firstDatasetRecord, secondDatasetRecord, thirdDatasetRecord] = datasetRecords
    if (!firstDatasetRecord || !secondDatasetRecord || !thirdDatasetRecord)
      throw new Error("The helper saves three dataset records")
    organizationId = organization.id
    projectId = project.id
    evaluationConversationRunId = run.id
    return {
      organization,
      project,
      datasetRecords: [firstDatasetRecord, secondDatasetRecord, thirdDatasetRecord] as const,
      run,
    }
  }

  const subject = (query: Record<string, string> = { page: "0", limit: "100" }) =>
    request({
      route: EvalConversationRunsRoutes.getRecords,
      pathParams: { organizationId, projectId, evaluationConversationRunId },
      query,
      token: "token",
    })

  it("returns an empty page when the run has no record", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.getRecords, response)
    expect(response.body.data).toStrictEqual({ records: [], total: 0, page: 0, limit: 100 })
  })

  it("returns a graded record and a failed record", async () => {
    const { organization, project, datasetRecords, run } = await createContext()
    const [firstDatasetRecord, secondDatasetRecord] = datasetRecords
    const gradedRecord = await repositories.evaluationConversationRunRecordRepository.save(
      evaluationConversationRunRecordFactory
        .transient({
          organization,
          project,
          evaluationConversationRun: run,
          evaluationConversationDatasetRecord: firstDatasetRecord,
        })
        .build({
          status: "graded",
          output: "The answer is 2",
          formState: { title: "Request", summary: "Compare options", count: 0, enabled: false },
          score: 4,
          traceId: "trace-1",
          createdAt: new Date("2024-01-01"),
        }),
    )
    const failedRecord = await repositories.evaluationConversationRunRecordRepository.save(
      evaluationConversationRunRecordFactory
        .transient({
          organization,
          project,
          evaluationConversationRun: run,
          evaluationConversationDatasetRecord: secondDatasetRecord,
        })
        .build({
          status: "error",
          output: null,
          formState: null,
          score: null,
          errorDetails: "The model did not answer",
          traceId: null,
          createdAt: new Date("2024-01-02"),
        }),
    )

    const response = await subject()

    expect(response.body.data).toStrictEqual({
      records: [
        {
          id: gradedRecord.id,
          evaluationConversationDatasetRecordId: firstDatasetRecord.id,
          status: "graded",
          input: gradedRecord.input,
          expectedOutput: gradedRecord.expectedOutput,
          output: "The answer is 2",
          formState: { title: "Request", summary: "Compare options", count: 0, enabled: false },
          score: 4,
          errorDetails: null,
          traceUrl: "https://traces.example.org/redirects/sessions/trace-1",
        },
        {
          id: failedRecord.id,
          evaluationConversationDatasetRecordId: secondDatasetRecord.id,
          status: "error",
          input: failedRecord.input,
          expectedOutput: failedRecord.expectedOutput,
          output: null,
          formState: null,
          score: null,
          errorDetails: "The model did not answer",
          traceUrl: null,
        },
      ],
      total: 2,
      page: 0,
      limit: 100,
    })
    expectSchemaResponse(EvalConversationRunsRoutes.getRecords, response)
  })

  it("returns an empty form as an empty form", async () => {
    const { organization, project, datasetRecords, run } = await createContext()
    await repositories.evaluationConversationRunRecordRepository.save(
      evaluationConversationRunRecordFactory
        .transient({
          organization,
          project,
          evaluationConversationRun: run,
          evaluationConversationDatasetRecord: datasetRecords[0],
        })
        .build({ status: "graded", output: "The answer is 2", formState: {}, score: 4 }),
    )

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.getRecords, response)
    expect(response.body.data.records[0]?.formState).toStrictEqual({})
  })

  it("returns one page of the records", async () => {
    const { organization, project, datasetRecords, run } = await createContext()
    const records = await repositories.evaluationConversationRunRecordRepository.save(
      datasetRecords.map((datasetRecord, index) =>
        evaluationConversationRunRecordFactory
          .transient({
            organization,
            project,
            evaluationConversationRun: run,
            evaluationConversationDatasetRecord: datasetRecord,
          })
          .build({ createdAt: new Date(Date.UTC(2024, 0, index + 1)) }),
      ),
    )

    const response = await subject({ page: "1", limit: "2" })

    expectSchemaResponse(EvalConversationRunsRoutes.getRecords, response)
    expect(response.body.data.records.map((record) => record.id)).toEqual([records[2]?.id])
    expect(response.body.data).toMatchObject({ total: 3, page: 1, limit: 2 })
  })

  it("answers 400 for an empty page", async () => {
    await createContext()
    expectResponse(await subject({ page: "", limit: "100" }), 400)
  })

  it("answers 400 when limit is over 100", async () => {
    await createContext()
    expectResponse(await subject({ page: "0", limit: "101" }), 400)
  })

  it("answers 400 without a page and a limit, which the old endpoint defaulted", async () => {
    await createContext()
    expectResponse(await subject({}), 400)
  })
})
