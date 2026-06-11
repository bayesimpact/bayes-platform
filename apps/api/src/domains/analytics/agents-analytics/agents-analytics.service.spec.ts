import { BadRequestException } from "@nestjs/common"
import { days, endOfUtcDay, hours, minutes } from "@/common/test/date-helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { AgentsAnalyticsModule } from "./agents-analytics.module"
import { AgentsAnalyticsService } from "./agents-analytics.service"

describe("AgentsAnalyticsService", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let service: AgentsAnalyticsService

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsAnalyticsModule],
    })
    repositories = setup.getAllRepositories()
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<AgentsAnalyticsService>(AgentsAnalyticsService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  it("returns metrics only for the requested agent in the same project", async () => {
    const day1Start = new Date("2026-01-10T00:00:00.000Z")
    const day1End = endOfUtcDay(day1Start)

    const { organization, project, user } = await createOrganizationWithProject(repositories)

    const agentAlpha = agentFactory.transient({ organization, project }).build({ name: "Alpha" })
    const agentBeta = agentFactory.transient({ organization, project }).build({ name: "Beta" })
    await repositories.agentRepository.save([agentAlpha, agentBeta])

    const sessionAlpha1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: agentAlpha, user })
      .build({ createdAt: hours(1).after(day1Start), updatedAt: new Date() })
    const sessionAlpha2 = conversationAgentSessionFactory
      .transient({ organization, project, agent: agentAlpha, user })
      .build({ createdAt: hours(2).after(day1Start), updatedAt: new Date() })
    const sessionBeta1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: agentBeta, user })
      .build({ createdAt: hours(3).after(day1Start), updatedAt: new Date() })

    await repositories.conversationAgentSessionRepository.save([
      sessionAlpha1,
      sessionAlpha2,
      sessionBeta1,
    ])

    const userMessagesAlpha = [
      agentMessageFactory
        .user()
        .transient({ organization, project, session: sessionAlpha1 })
        .build({ createdAt: minutes(10).after(day1Start) }),
      agentMessageFactory
        .user()
        .transient({ organization, project, session: sessionAlpha1 })
        .build({ createdAt: minutes(20).after(day1Start) }),
    ]
    const userMessagesBeta = Array.from({ length: 6 }, (_unusedValue, messageIndex) =>
      agentMessageFactory
        .user()
        .transient({ organization, project, session: sessionBeta1 })
        .build({
          createdAt: minutes((messageIndex + 1) * 5).after(day1Start),
        }),
    )
    await repositories.agentMessageRepository.save([...userMessagesAlpha, ...userMessagesBeta])

    const connectScope = { organizationId: organization.id, projectId: project.id, userId: user.id }

    const alphaConversations = await service.getConversationsPerDay({
      connectScope,
      agentId: agentAlpha.id,
      startAt: day1Start.getTime(),
      endAt: day1End.getTime(),
    })
    expect(alphaConversations).toEqual([{ date: day1Start.toISOString().slice(0, 10), value: 2 }])

    const betaConversations = await service.getConversationsPerDay({
      connectScope,
      agentId: agentBeta.id,
      startAt: day1Start.getTime(),
      endAt: day1End.getTime(),
    })
    expect(betaConversations).toEqual([{ date: day1Start.toISOString().slice(0, 10), value: 1 }])

    const alphaAverages = await service.getAvgUserQuestionsPerSessionPerDay({
      connectScope,
      agentId: agentAlpha.id,
      startAt: day1Start.getTime(),
      endAt: day1End.getTime(),
    })
    expect(alphaAverages).toEqual([{ date: day1Start.toISOString().slice(0, 10), value: 1 }])

    const betaAverages = await service.getAvgUserQuestionsPerSessionPerDay({
      connectScope,
      agentId: agentBeta.id,
      startAt: day1Start.getTime(),
      endAt: day1End.getTime(),
    })
    expect(betaAverages).toEqual([{ date: day1Start.toISOString().slice(0, 10), value: 6 }])
  })

  it("does not leak sessions from other projects for the same agent id pattern", async () => {
    const dayStart = new Date("2026-02-15T00:00:00.000Z")
    const dayEnd = endOfUtcDay(dayStart)

    const {
      organization: targetOrganization,
      project: targetProject,
      user: targetUser,
    } = await createOrganizationWithProject(repositories)
    const {
      organization: otherOrganization,
      project: otherProject,
      user: otherUser,
    } = await createOrganizationWithProject(repositories)

    const otherAgent = agentFactory
      .transient({ organization: otherOrganization, project: otherProject })
      .build()
    await repositories.agentRepository.save(otherAgent)

    const leakedSession = conversationAgentSessionFactory
      .transient({
        organization: otherOrganization,
        project: otherProject,
        agent: otherAgent,
        user: otherUser,
      })
      .build({ createdAt: hours(1).after(dayStart), updatedAt: new Date() })
    await repositories.conversationAgentSessionRepository.save(leakedSession)

    const targetConnectScope = {
      organizationId: targetOrganization.id,
      projectId: targetProject.id,
      userId: targetUser.id,
    }

    const conversations = await service.getConversationsPerDay({
      connectScope: targetConnectScope,
      agentId: otherAgent.id,
      startAt: dayStart.getTime(),
      endAt: dayEnd.getTime(),
    })

    expect(conversations).toEqual([{ date: dayStart.toISOString().slice(0, 10), value: 0 }])
  })

  it("throws when endAt is before startAt", async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)

    const connectScope = { organizationId: organization.id, projectId: project.id, userId: user.id }
    const startAt = days(2).after(new Date("2026-03-01T00:00:00.000Z")).getTime()
    const endAt = new Date("2026-03-01T00:00:00.000Z").getTime()

    await expect(
      service.getConversationsPerDay({ connectScope, agentId: agent.id, startAt, endAt }),
    ).rejects.toThrow(BadRequestException)
  })

  it("returns category stats per day with uncategorized bucket", async () => {
    const day1Start = new Date("2026-03-11T00:00:00.000Z")
    const day2Start = new Date("2026-03-12T00:00:00.000Z")
    const day2End = endOfUtcDay(day2Start)

    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const agent = agentFactory.transient({ organization, project }).build({ name: "Support Agent" })
    await repositories.agentRepository.save(agent)

    const billingCategory = await setup
      .getRepository(AgentSessionCategory)
      .save({ agentId: agent.id, name: "billing" })

    const categorizedSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({ createdAt: hours(1).after(day1Start), updatedAt: new Date() })
    const uncategorizedSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({ createdAt: hours(2).after(day2Start), updatedAt: new Date() })
    await repositories.conversationAgentSessionRepository.save([
      categorizedSession,
      uncategorizedSession,
    ])

    await setup.getRepository(ConversationAgentSessionCategory).save([
      {
        conversationAgentSessionId: categorizedSession.id,
        agentSessionCategoryId: billingCategory.id,
      },
    ])

    const connectScope = { organizationId: organization.id, projectId: project.id, userId: user.id }

    const response = await service.getConversationsByCategoryPerDay({
      connectScope,
      agentId: agent.id,
      startAt: day1Start.getTime(),
      endAt: day2End.getTime(),
    })

    expect(response).toEqual([
      {
        date: "2026-03-11",
        agentId: agent.id,
        agentName: "Support Agent",
        categoryId: billingCategory.id,
        categoryName: "billing",
        value: 1,
        isUncategorized: false,
      },
      {
        date: "2026-03-12",
        agentId: agent.id,
        agentName: "Support Agent",
        categoryName: "uncategorized",
        value: 1,
        isUncategorized: true,
      },
    ])
  })
})
