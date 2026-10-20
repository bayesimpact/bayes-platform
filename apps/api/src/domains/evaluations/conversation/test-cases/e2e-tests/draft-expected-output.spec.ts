import { EvaluationConversationTestCasesRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { createConversationWithAnswers } from "./test-case.helpers"

describe("EvaluationConversationTestCases - draftExpectedOutput", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let mockProvider: AISDKMockProvider

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    mockProvider = setup.module.get(AISDKMockProvider)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockProvider.resetMock()
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const conversation = await createConversationWithAnswers(repositories)
    organizationId = conversation.organization.id
    projectId = conversation.project.id
    authSubject = conversation.user.authSubject!
    return conversation
  }

  const subject = async (agentMessageId: string, comment: string) =>
    request({
      route: EvaluationConversationTestCasesRoutes.draftExpectedOutput,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: { payload: { agentMessageId, comment } },
    })

  it("drafts the answer the agent should have given from what is wrong", async () => {
    const { agent, lastAnswer } = await createContext()
    mockProvider.addTextTurn(agent.id, "Yes, the unused part becomes store credit.")

    const res = await subject(lastAnswer.id, "A plan switch gives store credit, not a refund.")

    expectResponse(res, 201)
    expect(res.body.data).toEqual({ expectedOutput: "Yes, the unused part becomes store credit." })
    const [call] = mockProvider.getCalls()
    expect(call?.prompt).toContain("A plan switch gives store credit, not a refund.")
    expect(call?.prompt).toContain("Yes, the unused part is refunded to your card.")
  })

  it("requires saying what is wrong", async () => {
    const { lastAnswer } = await createContext()

    expectResponse(await subject(lastAnswer.id, "   "), 422)
    expect(mockProvider.getCalls()).toHaveLength(0)
  })
})
