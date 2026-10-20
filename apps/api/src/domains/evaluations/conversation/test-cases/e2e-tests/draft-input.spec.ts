import { randomUUID } from "node:crypto"
import {
  type EvaluationConversationTestCaseInputMode,
  EvaluationConversationTestCasesRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { createConversationWithAnswers } from "./test-case.helpers"

describe("EvaluationConversationTestCases - draftInput", () => {
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
    mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
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

  const subject = async (
    agentMessageId: string,
    inputMode: EvaluationConversationTestCaseInputMode | null = null,
  ) =>
    request({
      route: EvaluationConversationTestCasesRoutes.draftInput,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: { payload: { agentMessageId, inputMode } },
    })

  it("drafts a standalone question from the conversation when the answer has earlier turns", async () => {
    const { agent, lastAnswer } = await createContext()
    mockProvider.addTextTurn(agent.id, "On the annual Pro plan since March 3, can I switch?")

    const res = await subject(lastAnswer.id)

    expectResponse(res, 201)
    expect(res.body.data).toEqual({
      inputMode: "conversation",
      input: "On the annual Pro plan since March 3, can I switch?",
      lastUserMessage: "Can I switch to the monthly plan and get the difference back?",
      earlierTurnCount: 1,
    })
    const [call] = mockProvider.getCalls()
    expect(call?.prompt).toContain("User: I bought the annual Pro plan on March 3.")
    expect(call?.prompt).toContain("Yes, the unused part is refunded to your card.")
  })

  it("returns the last message as sent when asked, without calling the model", async () => {
    const { lastAnswer } = await createContext()

    const res = await subject(lastAnswer.id, "lastMessage")

    expectResponse(res, 201)
    expect(res.body.data).toMatchObject({
      inputMode: "lastMessage",
      input: "Can I switch to the monthly plan and get the difference back?",
    })
    expect(mockProvider.getCalls()).toHaveLength(0)
  })

  it("uses the first message as the input of an answer to it", async () => {
    const { firstAnswer } = await createContext()

    const res = await subject(firstAnswer.id, "conversation")

    expectResponse(res, 201)
    expect(res.body.data).toEqual({
      inputMode: "lastMessage",
      input: "I bought the annual Pro plan on March 3.",
      lastUserMessage: "I bought the annual Pro plan on March 3.",
      earlierTurnCount: 0,
    })
    expect(mockProvider.getCalls()).toHaveLength(0)
  })

  it("does not treat a user message as an answer", async () => {
    const { lastQuestion } = await createContext()

    expectResponse(await subject(lastQuestion.id), 404)
  })

  it("does not find an answer of another project", async () => {
    const otherConversation = await createConversationWithAnswers(repositories)
    await createContext()

    expectResponse(await subject(otherConversation.lastAnswer.id), 404)
    expectResponse(await subject(randomUUID()), 404)
  })

  it("rejects an answer that failed", async () => {
    const { lastAnswer } = await createContext()
    await repositories.agentMessageRepository.update(lastAnswer.id, { status: "error" })

    expectResponse(await subject(lastAnswer.id), 422)
  })
})
