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
import { EvaluationConversationRun } from "../evaluation-conversation-run.entity"
import { evaluationConversationRunFactory } from "../evaluation-conversation-run.factory"

describe("EvaluationConversationRuns - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
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

    return { organization, project, dataset, agent, agentSettings }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationRunsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("should return an empty list when no runs exist", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data).toEqual([])
  })

  it("should return all runs for the project", async () => {
    const { organization, project, dataset, agent, agentSettings } = await createContext()

    const run1 = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build()
    const run2 = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build()
    await setup.getRepository(EvaluationConversationRun).save([run1, run2])

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data).toHaveLength(2)
  })
})
