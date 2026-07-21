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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationDataset } from "../../datasets/evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../../datasets/evaluation-conversation-dataset.factory"
import { EvaluationConversationRun } from "../evaluation-conversation-run.entity"
import { evaluationConversationRunFactory } from "../evaluation-conversation-run.factory"

describe("EvaluationConversationRuns - getOne", () => {
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

    const run = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build()
    await setup.getRepository(EvaluationConversationRun).save(run)
    evaluationConversationRunId = run.id

    return { organization, project, dataset, agent, agentSettings, run }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationRunsRoutes.getOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationConversationRunId }),
      token: accessToken,
    })

  it("should return the evaluation run", async () => {
    const { run, dataset, agent } = await createContext()

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.id).toBe(run.id)
    expect(res.body.data.evaluationConversationDatasetId).toBe(dataset.id)
    expect(res.body.data.agentId).toBe(agent.id)
    expect(res.body.data.status).toBe("pending")
  })

  it("should keep exposing the pinned agent settings after the agent advances to a newer revision", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const newerSettings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, instructions: "Newer helpful assistant instructions" })
    await repositories.agentSettingsRepository.save(newerSettings)

    const res = await subject()

    expectResponse(res, 200)
    expect(res.body.data.agentSettings).toEqual({
      documentsRagMode: agentSettings.documentsRagMode,
      instructions: agentSettings.instructions,
      locale: agentSettings.locale,
      model: agentSettings.model,
      revision: agentSettings.revision,
      temperature: Number(agentSettings.temperature),
    })
  })

  it("should return 404 for a non-existent run", async () => {
    await createContext()
    evaluationConversationRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject()

    expectResponse(res, 404)
  })
})
