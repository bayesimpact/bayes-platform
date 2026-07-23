import { ConversationAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentSubAgentFactory } from "@/domains/agents/sub-agents/agent-sub-agent.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { conversationAgentSessionFactory } from "../conversation-agent-session.factory"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions.module"

const OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, summary: { type: "string" } },
}

describe("ConversationAgentSessionsRoutes.listSubSessions", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let parentAgentId: string
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent, agentSession } =
      await createOrganizationWithAgentSession({ repositories, agentType: "conversation" })
    organizationId = organization.id
    projectId = project.id
    parentAgentId = agent.id
    auth0Id = user.auth0Id

    // A fillForm-enabled conversation sub-agent whose sub-session accumulates a form result.
    const fillFormChildAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        name: "Form Filler Assistant",
        type: "conversation",
      }),
    )
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent: fillFormChildAgent })
        .build({ fillFormEnabled: true, outputJsonSchema: OUTPUT_JSON_SCHEMA }),
    )
    await repositories.agentSubAgentRepository.save(
      agentSubAgentFactory
        .transient({ parentAgent: agent, childAgent: fillFormChildAgent })
        .tool({ toolName: "collect_details", description: "Collect structured details" })
        .build({ enabled: true }),
    )
    const fillFormSubSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, user, agent: fillFormChildAgent })
        .playground()
        .build({
          parentSessionId: agentSession.id,
          result: { title: "Draft title" },
        }),
    )

    // A plain conversation sub-agent (no fillForm) with its own sub-session: excluded.
    const conversationChildAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        name: "Helpful Assistant",
        type: "conversation",
      }),
    )
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent: conversationChildAgent })
        .build(),
    )
    await repositories.agentSubAgentRepository.save(
      agentSubAgentFactory
        .transient({ parentAgent: agent, childAgent: conversationChildAgent })
        .tool({ toolName: "ask_helper", description: "Ask the helper a question" })
        .build({ enabled: true }),
    )
    await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, user, agent: conversationChildAgent })
        .playground()
        .build({ parentSessionId: agentSession.id }),
    )

    return { parentSession: agentSession, fillFormChildAgent, fillFormSubSession }
  }

  const subject = async (agentSessionId: string) =>
    request({
      route: ConversationAgentSessionsRoutes.listSubSessions,
      pathParams: removeNullish({
        organizationId,
        projectId,
        agentId: parentAgentId,
        agentSessionId,
      }),
      token: "token",
      request: { payload: { type: "playground" } },
    })

  it("returns only the fillForm-enabled sub-sessions delegated by the parent session", async () => {
    const { parentSession, fillFormChildAgent, fillFormSubSession } = await createContext()

    const response = await subject(parentSession.id)

    expectResponse(response, 201)
    const subSessions = response.body.data
    expect(subSessions).toHaveLength(1)
    expect(subSessions[0]).toMatchObject({
      toolName: "collect_details",
      agentId: fillFormChildAgent.id,
      agentName: "Form Filler Assistant",
      outputJsonSchema: OUTPUT_JSON_SCHEMA,
    })
    expect(subSessions[0]?.session.id).toBe(fillFormSubSession.id)
    expect(subSessions[0]?.session.result).toEqual({ title: "Draft title" })
  })

  it("returns an empty list when the parent session has no sub-sessions", async () => {
    await createContext()

    const response = await subject("22222222-2222-2222-2222-222222222222")

    expectResponse(response, 201)
    expect(response.body.data).toHaveLength(0)
  })
})
