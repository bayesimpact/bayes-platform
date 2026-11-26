import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { EvalExtractionRunsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { evaluationExtractionDatasetRecordFactory } from "@/domains/evaluations/extraction/datasets/records/evaluation-extraction-dataset-record.factory"
import { createRunWithCsvDataset } from "@/domains/evaluations/extraction/runs/e2e-tests/csv-dataset.helpers"
import { evaluationExtractionRunRecordFactory } from "@/domains/evaluations/extraction/runs/records/evaluation-extraction-run-record.factory"
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

const KEY_MAPPING = [
  { agentOutputKey: "answer", datasetColumnId: "col-answer", mode: "scored" as const },
]

describe("Evaluation extraction runs - getRecords", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationExtractionRunId: string
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
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A run of an extraction agent over a CSV dataset, pending until a test changes it. */
  const createContext = async (agentType: "conversation" | "extraction" = "extraction") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: agentType },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { answer: { type: "string" } } },
          model: AgentModel._Mock,
          instructions: "Published instructions",
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    const { dataset, datasetRecords, run } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: KEY_MAPPING,
    })
    evaluationExtractionRunId = run.id
    return { organization, project, agent, agentSettings, dataset, datasetRecords, run }
  }

  const subject = (query: Record<string, string> = { page: "0", limit: "100" }) =>
    request({
      route: EvalExtractionRunsRoutes.getRecords,
      pathParams: { organizationId, projectId, evaluationExtractionRunId },
      query,
      token: "token",
    })

  it("returns an empty page when the run has no record", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.getRecords, response)
    expect(response.body.data).toStrictEqual({ records: [], total: 0, page: 0, limit: 100 })
  })

  it("returns a matched record and a failed record", async () => {
    const { organization, project, datasetRecords, run } = await createContext()
    const [firstDatasetRecord, secondDatasetRecord] = datasetRecords
    const matchedRecord = await repositories.evaluationExtractionRunRecordRepository.save(
      evaluationExtractionRunRecordFactory
        .transient({
          organization,
          project,
          evaluationExtractionRun: run,
          evaluationExtractionDatasetRecord: firstDatasetRecord,
        })
        .build({
          status: "match",
          comparison: { answer: { agentValue: "2", groundTruth: "2", status: "match" } },
          traceId: "trace-1",
          createdAt: new Date("2024-01-01"),
        }),
    )
    const failedRecord = await repositories.evaluationExtractionRunRecordRepository.save(
      evaluationExtractionRunRecordFactory
        .transient({
          organization,
          project,
          evaluationExtractionRun: run,
          evaluationExtractionDatasetRecord: secondDatasetRecord,
        })
        .build({
          status: "error",
          comparison: null,
          errorDetails: "The model did not answer",
          traceId: null,
          createdAt: new Date("2024-01-02"),
        }),
    )

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.getRecords, response)
    expect(response.body.data).toStrictEqual({
      records: [
        {
          id: matchedRecord.id,
          evaluationExtractionDatasetRecordId: firstDatasetRecord?.id,
          status: "match",
          comparison: { answer: { agentValue: "2", groundTruth: "2", status: "match" } },
          errorDetails: null,
          datasetRecordData: firstDatasetRecord?.data,
          traceUrl: "https://traces.example.org/redirects/sessions/trace-1",
        },
        {
          id: failedRecord.id,
          evaluationExtractionDatasetRecordId: secondDatasetRecord?.id,
          status: "error",
          comparison: null,
          errorDetails: "The model did not answer",
          datasetRecordData: secondDatasetRecord?.data,
          traceUrl: null,
        },
      ],
      total: 2,
      page: 0,
      limit: 100,
    })
  })

  it("orders the records with the same sort value by their dataset record", async () => {
    const { organization, project, dataset, run } = await createContext()
    const datasetRecords = await repositories.evaluationExtractionDatasetRecordRepository.save(
      evaluationExtractionDatasetRecordFactory
        .transient({ organization, project, evaluationExtractionDataset: dataset })
        .buildList(3, { data: { "col-question": "same value" } }),
    )
    const sortedDatasetRecordIds = datasetRecords.map((record) => record.id).sort()
    // Saved in the reverse order: the order of the rows on disk is not the one expected.
    for (const datasetRecordId of [...sortedDatasetRecordIds].reverse()) {
      await repositories.evaluationExtractionRunRecordRepository.save(
        evaluationExtractionRunRecordFactory
          .transient({
            organization,
            project,
            evaluationExtractionRun: run,
            evaluationExtractionDatasetRecord: datasetRecords.find(
              (record) => record.id === datasetRecordId,
            ),
          })
          .build({ status: "match" }),
      )
    }

    const response = await subject({
      page: "0",
      limit: "100",
      sortBy: "input_col-question",
      sortOrder: "asc",
      columnFilters: '{"input_col-question":"same"}',
    })

    expectSchemaResponse(EvalExtractionRunsRoutes.getRecords, response)
    expect(
      response.body.data.records.map((record) => record.evaluationExtractionDatasetRecordId),
    ).toEqual(sortedDatasetRecordIds)
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

  it("answers 400 for columnFilters that is not JSON", async () => {
    await createContext()
    expectResponse(await subject({ page: "0", limit: "100", columnFilters: "{not json" }), 400)
  })

  it("answers 400 for a sort order that is not asc or desc", async () => {
    await createContext()
    expectResponse(await subject({ page: "0", limit: "100", sortOrder: "up" }), 400)
  })

  // A failed run keeps what it knows of each record: the error fields, and no comparison.
  it("returns a failed run with its error fields", async () => {
    const { organization, project, datasetRecords, run } = await createContext()
    await repositories.evaluationExtractionRunRepository.update(run.id, { status: "failed" })
    await repositories.evaluationExtractionRunRecordRepository.save(
      evaluationExtractionRunRecordFactory
        .transient({
          organization,
          project,
          evaluationExtractionRun: run,
          evaluationExtractionDatasetRecord: datasetRecords[0],
        })
        .build({ status: "error", comparison: null, errorDetails: "The model is down" }),
    )

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.getRecords, response)
    expect(response.body.data.records[0]).toMatchObject({
      status: "error",
      comparison: null,
      errorDetails: "The model is down",
    })
  })
})
