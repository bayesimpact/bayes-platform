import {
  AgentLocale,
  AgentModel,
  AgentsRoutes,
  ConversationAgentSessionsRoutes,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions/conversation-agent-sessions.module"

// Mock Langfuse to avoid dynamic import issues in Jest (session creation touches tracing).
jest.mock("langfuse", () => {
  return {
    Langfuse: class {
      shutdownAsync() {
        return Promise.resolve()
      }
      flushAsync() {
        return Promise.resolve()
      }
      trace() {
        return { update: jest.fn() }
      }
    },
  }
})
jest.mock("langfuse-v2", () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: jest.fn(),
    span: jest.fn().mockReturnValue({ getTraceUrl: jest.fn() }),
    generation: jest.fn(),
    flushAsync: jest.fn().mockResolvedValue(undefined),
    shutdownAsync: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn(),
  })),
}))

describe("Agents - a freshly created agent is usable", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ConversationAgentSessionsModule, ActivitiesModule],
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
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContextWithoutAgent = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const createAgentPayload = () => ({
    type: "conversation" as const,
    name: "New Agent",
    instructions: "This is a default prompt",
    documentsRagMode: DocumentsRagMode.All,
    model: AgentModel.Gemini25Flash,
    temperature: 0,
    locale: AgentLocale.EN,
    tagsToAdd: [],
    projectAgentSessionCategoryIds: [],
  })

  it("should let a freshly created agent start a conversation session", async () => {
    await createContextWithoutAgent()

    const createResponse = await request({
      route: AgentsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      request: { payload: createAgentPayload() },
      token: accessToken,
    })
    expectResponse(createResponse, 201)
    const agentId = createResponse.body.data.id

    const sessionResponse = await request({
      route: ConversationAgentSessionsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      request: { payload: { type: "playground" } },
      token: accessToken,
    })

    expectResponse(sessionResponse, 201)
  })

  it("should create revision 1 already published", async () => {
    await createContextWithoutAgent()

    const createResponse = await request({
      route: AgentsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      request: { payload: createAgentPayload() },
      token: accessToken,
    })

    expectResponse(createResponse, 201)
    const stored = await repositories.agentSettingsRepository.find({
      where: { agentId: createResponse.body.data.id },
    })
    expect(stored).toHaveLength(1)
    expect(stored[0]?.isDraft).toBe(false)
    expect(stored[0]?.revision).toBe(1)
  })
})
