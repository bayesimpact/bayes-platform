import { AgentModel, EvaluationReportsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { evaluationFactory } from "@/domains/evaluations/evaluation.factory"
import { EvaluationsModule } from "@/domains/evaluations/evaluations.module"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"

describe("Evaluation Reports - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let evaluationId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>
  let mockProvider: AISDKMockProvider

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockProvider.resetMock()
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      organizationMembership: { role: "owner" },
      agentSettings: { model: AgentModel._Mock },
    })
    organizationId = organization.id
    projectId = project.id

    auth0Id = user.auth0Id
    agentId = agent.id

    const evaluation = evaluationFactory.transient({ organization, project }).build({
      input: "test input",
      expectedOutput: "test output",
    })
    await repositories.evaluationRepository.save(evaluation)
    evaluationId = evaluation.id

    return { organization, project, evaluation }
  }

  const subject = async () =>
    request({
      route: EvaluationReportsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, evaluationId }),
      token: accessToken,
    })

  it("should create an evaluation report", async () => {
    await createContext()

    const generatedOutput = "A generated answer."
    mockProvider.addTextTurn(agentId, generatedOutput)
    mockProvider.addTextTurn("Custom-Rating-Agent", "76")

    const res = await subject()
    expectResponse(res, 201)
    expect(res.body.data).toMatchObject({ agentId, evaluationId })
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.createdAt).toBeDefined()
    expect(res.body.data.updatedAt).toBeDefined()
    expect(res.body.data.output).toBe(generatedOutput)
    expect(res.body.data.score).toBe("76")
    await expectActivityCreated("evaluationReport.create")
  })
})
