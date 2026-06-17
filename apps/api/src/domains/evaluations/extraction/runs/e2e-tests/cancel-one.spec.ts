import { AgentModel, EvaluationExtractionRunsRoutes } from "@caseai-connect/api-contracts"
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
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationExtractionRun } from "../evaluation-extraction-run.entity"
import { EvaluationExtractionRunRecord } from "../records/evaluation-extraction-run-record.entity"
import { evaluationExtractionRunRecordFactory } from "../records/evaluation-extraction-run-record.factory"
import { createRunWithCsvDataset } from "./csv-dataset.helpers"

describe("EvaluationExtractionRuns - cancelOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationExtractionRunId: string
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
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const agent = agentFactory.transient({ organization, project }).build({
      type: "extraction",
      outputJsonSchema: { type: "object", properties: { answer: { type: "string" } } },
      model: AgentModel._MockGenerateStructuredOutput,
    })
    await repositories.agentRepository.save(agent)

    const { run, datasetRecords } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      keyMapping: [{ agentOutputKey: "answer", datasetColumnId: "col-answer", mode: "scored" }],
    })
    evaluationExtractionRunId = run.id

    // A still-running record so the cancel path has something to transition to "cancelled".
    const runningRecord = evaluationExtractionRunRecordFactory
      .transient({
        organization,
        project,
        evaluationExtractionRun: run,
        evaluationExtractionDatasetRecord: datasetRecords[0],
      })
      .build({ status: "running" })
    await setup.getRepository(EvaluationExtractionRunRecord).save(runningRecord)

    return { organization, project, run, runningRecord }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionRunsRoutes.cancelOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
      token: accessToken,
    })

  it("cancels a pending run", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("cancelled")

    const run = await setup
      .getRepository(EvaluationExtractionRun)
      .findOneBy({ id: evaluationExtractionRunId })
    expect(run?.status).toBe("cancelled")

    await expectActivityCreated("evaluationExtractionRun.cancel")
  })

  it("cancels a running run and marks its running records cancelled", async () => {
    const { run, runningRecord } = await createContext()
    await setup.getRepository(EvaluationExtractionRun).update({ id: run.id }, { status: "running" })

    const res = await subject()

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("cancelled")

    const record = await setup
      .getRepository(EvaluationExtractionRunRecord)
      .findOneBy({ id: runningRecord.id })
    expect(record?.status).toBe("cancelled")
  })

  it("rejects cancelling a completed run", async () => {
    const { run } = await createContext()
    await setup
      .getRepository(EvaluationExtractionRun)
      .update({ id: run.id }, { status: "completed" })

    const res = await subject()

    expectResponse(res, 422)
  })

  it("rejects cancelling an already-cancelled run", async () => {
    const { run } = await createContext()
    await setup
      .getRepository(EvaluationExtractionRun)
      .update({ id: run.id }, { status: "cancelled" })

    const res = await subject()

    expectResponse(res, 422)
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    evaluationExtractionRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject()

    expectResponse(res, 404)
  })
})
