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
import { EvaluationExtractionRun } from "../evaluation-extraction-run.entity"
import { evaluationExtractionRunFactory } from "../evaluation-extraction-run.factory"

describe("EvaluationExtractionRuns - getOne", () => {
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

    const run = evaluationExtractionRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationExtractionDataset: dataset,
      })
      .build()
    await setup.getRepository(EvaluationExtractionRun).save(run)
    evaluationExtractionRunId = run.id

    return { organization, project, dataset, agent, run }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionRunsRoutes.getOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationExtractionRunId }),
      token: accessToken,
    })

  it("should return the evaluation run", async () => {
    const { run, dataset, agent } = await createContext()

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.id).toBe(run.id)
    expect(res.body.data.evaluationExtractionDatasetId).toBe(dataset.id)
    expect(res.body.data.agentId).toBe(agent.id)
    expect(res.body.data.status).toBe("pending")
  })

  it("should return 404 for a non-existent run", async () => {
    await createContext()
    evaluationExtractionRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject()

    expectResponse(res, 404)
  })
})
