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
import { createRunWithCsvDataset } from "./csv-dataset.helpers"

describe("EvaluationExtractionRuns - executeOne", () => {
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

  const createContext = async ({ agentOutputKey = "answer" }: { agentOutputKey?: string } = {}) => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const agent = agentFactory.transient({ organization, project }).build({
      type: "extraction",
      outputJsonSchema: {
        type: "object",
        properties: {
          answer: { type: "string" },
        },
      },
      model: AgentModel._MockGenerateStructuredOutput,
      defaultPrompt: "Extract the answer from the input",
    })
    await repositories.agentRepository.save(agent)

    const { dataset, datasetRecords, run } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      keyMapping: [{ agentOutputKey, datasetColumnId: "col-answer", mode: "scored" }],
    })
    evaluationExtractionRunId = run.id

    return { organization, project, agent, dataset, datasetRecords, run }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionRunsRoutes.executeOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
      token: accessToken,
    })

  it("creates run records, enqueues per-record jobs, and returns the run as pending", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("pending")
    expect(res.body.data.summary).toBeNull()

    await expectActivityCreated("evaluationExtractionRun.execute")
  })

  it("should return 404 for a non-existent run", async () => {
    await createContext()
    evaluationExtractionRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject()

    expectResponse(res, 404)
  })
})
