import { randomUUID } from "node:crypto"
import { AgentAnalyticsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsAnalyticsModule } from "../agents-analytics.module"

describe("Agents Analytics - getConversationsByCategoryPerDay", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const day1Start = new Date("2026-01-01T00:00:00.000Z")
  const day2Start = new Date("2026-01-02T00:00:00.000Z")
  const day2End = new Date("2026-01-02T23:59:59.999Z")

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsAnalyticsModule],
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
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, user, agent } = await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id

    const billingCategory = await setup
      .getRepository(AgentSessionCategory)
      .save({ agentId: agent.id, name: "billing" })

    const day1CategorySession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({
        createdAt: new Date(day1Start.getTime() + 1 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
    const day2UncategorizedSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({
        createdAt: new Date(day2Start.getTime() + 2 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
    await repositories.conversationAgentSessionRepository.save([
      day1CategorySession,
      day2UncategorizedSession,
    ])

    await setup.getRepository(ConversationAgentSessionCategory).save([
      {
        conversationAgentSessionId: day1CategorySession.id,
        agentSessionCategoryId: billingCategory.id,
      },
    ])
  }

  const subject = async () =>
    request({
      route: AgentAnalyticsRoutes.getConversationsByCategoryPerDay,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      query: {
        startAt: String(day1Start.getTime()),
        endAt: String(day2End.getTime()),
      },
    })

  it("returns per-day category stats for the agent", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      {
        date: "2026-01-01",
        categoryName: "billing",
        value: 1,
        isUncategorized: false,
        agentId: expect.any(String),
        agentName: expect.any(String),
        categoryId: expect.any(String),
      },
      {
        date: "2026-01-02",
        categoryName: "uncategorized",
        value: 1,
        isUncategorized: true,
        agentId: expect.any(String),
        agentName: expect.any(String),
      },
    ])
  })
})
