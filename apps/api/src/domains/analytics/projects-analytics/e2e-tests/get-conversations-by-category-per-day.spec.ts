import { randomUUID } from "node:crypto"
import { AnalyticsRoutes } from "@caseai-connect/api-contracts"
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
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsAnalyticsModule } from "../projects-analytics.module"

describe("Projects Analytics - getConversationsByCategoryPerDay", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let supportAgentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const day1Start = new Date("2026-01-01T00:00:00.000Z")
  const day2Start = new Date("2026-01-02T00:00:00.000Z")
  const day2End = new Date("2026-01-02T23:59:59.999Z")

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsAnalyticsModule],
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
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
      projectMembership: { role: "admin" },
    })
    organizationId = organization.id
    projectId = project.id

    const supportAgent = agentFactory
      .transient({ organization, project })
      .build({ name: "Support" })
    const salesAgent = agentFactory.transient({ organization, project }).build({ name: "Sales" })
    await repositories.agentRepository.save([supportAgent, salesAgent])
    supportAgentId = supportAgent.id

    const billingCategory = await setup
      .getRepository(AgentSessionCategory)
      .save({ agentId: supportAgent.id, name: "billing" })
    const onboardingCategory = await setup
      .getRepository(AgentSessionCategory)
      .save({ agentId: salesAgent.id, name: "onboarding" })

    const supportDay1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: supportAgent, user })
      .build({
        createdAt: new Date(day1Start.getTime() + 1 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
    const supportDay2Uncategorized = conversationAgentSessionFactory
      .transient({ organization, project, agent: supportAgent, user })
      .build({
        createdAt: new Date(day2Start.getTime() + 1 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
    const salesDay2 = conversationAgentSessionFactory
      .transient({ organization, project, agent: salesAgent, user })
      .build({
        createdAt: new Date(day2Start.getTime() + 2 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })

    await repositories.conversationAgentSessionRepository.save([
      supportDay1,
      supportDay2Uncategorized,
      salesDay2,
    ])

    await setup.getRepository(ConversationAgentSessionCategory).save([
      { conversationAgentSessionId: supportDay1.id, agentSessionCategoryId: billingCategory.id },
      { conversationAgentSessionId: salesDay2.id, agentSessionCategoryId: onboardingCategory.id },
    ])
  }

  const subject = async (agentId?: string) =>
    request({
      route: AnalyticsRoutes.getConversationsByCategoryPerAgentPerDay,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      query: {
        startAt: String(day1Start.getTime()),
        endAt: String(day2End.getTime()),
        ...(agentId ? { agentId } : {}),
      },
    })

  it("returns per-day category stats for the selected agent", async () => {
    await createContext()

    const response = await subject(supportAgentId)

    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      {
        date: "2026-01-01",
        agentName: "Support",
        categoryName: "billing",
        value: 1,
        isUncategorized: false,
        agentId: expect.any(String),
        categoryId: expect.any(String),
      },
      {
        date: "2026-01-02",
        agentName: "Support",
        categoryName: "uncategorized",
        value: 1,
        isUncategorized: true,
        agentId: expect.any(String),
      },
    ])
  })

  it("returns per-day category stats across all agents when agentId is omitted", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      {
        date: "2026-01-01",
        agentName: "Support",
        categoryName: "billing",
        value: 1,
        isUncategorized: false,
        agentId: expect.any(String),
        categoryId: expect.any(String),
      },
      {
        date: "2026-01-02",
        agentName: "Sales",
        categoryName: "onboarding",
        value: 1,
        isUncategorized: false,
        agentId: expect.any(String),
        categoryId: expect.any(String),
      },
      {
        date: "2026-01-02",
        agentName: "Support",
        categoryName: "uncategorized",
        value: 1,
        isUncategorized: true,
        agentId: expect.any(String),
      },
    ])
  })
})
