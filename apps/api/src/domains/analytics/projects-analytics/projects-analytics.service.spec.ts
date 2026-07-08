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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ProjectsAnalyticsModule } from "./projects-analytics.module"
import { ProjectsAnalyticsService } from "./projects-analytics.service"

describe("ProjectsAnalyticsService", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let service: ProjectsAnalyticsService

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsAnalyticsModule],
    })
    repositories = setup.getAllRepositories()
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<ProjectsAnalyticsService>(ProjectsAnalyticsService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  it("returns analytics for all agents by default and can filter by agent", async () => {
    const day1Start = new Date("2026-01-01T00:00:00.000Z")
    const day2Start = days(1).after(day1Start)
    const day3Start = days(2).after(day1Start)
    const day3End = endOfUtcDay(day3Start)

    const { organization, project, user } = await createOrganizationWithProject(repositories)

    const primaryAgent = agentFactory.transient({ organization, project }).build()
    const secondaryAgent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save([primaryAgent, secondaryAgent])

    const primaryAgentSettings = agentSettingsFactory
      .transient({ organization, project, agent: primaryAgent })
      .build()
    const secondaryAgentSettings = agentSettingsFactory
      .transient({ organization, project, agent: secondaryAgent })
      .build()
    await repositories.agentSettingsRepository.save([primaryAgentSettings, secondaryAgentSettings])

    const session1Day1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: primaryAgent, user })
      .build({ createdAt: hours(1).after(day1Start), updatedAt: new Date() })
    const session2Day1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: primaryAgent, user })
      .build({ createdAt: hours(2).after(day1Start), updatedAt: new Date() })
    const session3Day2 = conversationAgentSessionFactory
      .transient({ organization, project, agent: primaryAgent, user })
      .build({ createdAt: hours(1).after(day2Start), updatedAt: new Date() })
    const session4Day2 = conversationAgentSessionFactory
      .transient({ organization, project, agent: secondaryAgent, user })
      .build({ createdAt: hours(3).after(day2Start), updatedAt: new Date() })

    await repositories.conversationAgentSessionRepository.save([
      session1Day1,
      session2Day1,
      session3Day2,
      session4Day2,
    ])

    const userMessagesSession1 = [
      agentMessageFactory
        .user()
        .transient({
          organization,
          project,
          session: session1Day1,
          agentSettings: primaryAgentSettings,
        })
        .build({
          createdAt: minutes(10).after(day1Start),
        }),
      agentMessageFactory
        .user()
        .transient({
          organization,
          project,
          session: session1Day1,
          agentSettings: primaryAgentSettings,
        })
        .build({
          createdAt: minutes(20).after(day1Start),
          agentSettingsId: primaryAgentSettings.id,
        }),
    ]

    const userMessagesSession3 = Array.from({ length: 4 }, (_unusedValue, messageIndex) =>
      agentMessageFactory
        .user()
        .transient({
          organization,
          project,
          session: session3Day2,
          agentSettings: primaryAgentSettings,
        })
        .build({
          createdAt: minutes((messageIndex + 1) * 5).after(day2Start),
        }),
    )

    const userMessagesSession4 = [
      agentMessageFactory
        .user()
        .transient({
          organization,
          project,
          session: session4Day2,
          agentSettings: secondaryAgentSettings,
        })
        .build({
          createdAt: minutes(15).after(day2Start),
        }),
      agentMessageFactory
        .user()
        .transient({
          organization,
          project,
          session: session4Day2,
          agentSettings: secondaryAgentSettings,
        })
        .build({
          createdAt: minutes(25).after(day2Start),
        }),
    ]

    await repositories.agentMessageRepository.save([
      ...userMessagesSession1,
      ...userMessagesSession3,
      ...userMessagesSession4,
    ])

    const connectScope = { organizationId: organization.id, projectId: project.id, userId: user.id }

    const conversations = await service.getConversationsPerDay({
      connectScope,
      startAt: day1Start.getTime(),
      endAt: day3End.getTime(),
    })

    expect(conversations).toEqual([
      { date: day1Start.toISOString().slice(0, 10), value: 2 },
      { date: day2Start.toISOString().slice(0, 10), value: 2 },
      { date: day3Start.toISOString().slice(0, 10), value: 0 },
    ])

    const averages = await service.getAvgUserQuestionsPerSessionPerDay({
      connectScope,
      startAt: day1Start.getTime(),
      endAt: day3End.getTime(),
    })

    expect(averages).toEqual([
      { date: day1Start.toISOString().slice(0, 10), value: 1 },
      { date: day2Start.toISOString().slice(0, 10), value: 3 },
      { date: day3Start.toISOString().slice(0, 10), value: 0 },
    ])

    const filteredConversations = await service.getConversationsPerDay({
      connectScope,
      agentId: primaryAgent.id,
      startAt: day1Start.getTime(),
      endAt: day3End.getTime(),
    })

    expect(filteredConversations).toEqual([
      { date: day1Start.toISOString().slice(0, 10), value: 2 },
      { date: day2Start.toISOString().slice(0, 10), value: 1 },
      { date: day3Start.toISOString().slice(0, 10), value: 0 },
    ])

    const filteredAverages = await service.getAvgUserQuestionsPerSessionPerDay({
      connectScope,
      agentId: primaryAgent.id,
      startAt: day1Start.getTime(),
      endAt: day3End.getTime(),
    })

    expect(filteredAverages).toEqual([
      { date: day1Start.toISOString().slice(0, 10), value: 1 },
      { date: day2Start.toISOString().slice(0, 10), value: 4 },
      { date: day3Start.toISOString().slice(0, 10), value: 0 },
    ])
  })

  it("getConversationsPerDay should not leak data from other projects", async () => {
    const dayStart = new Date("2026-02-01T00:00:00.000Z")
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
      startAt: dayStart.getTime(),
      endAt: dayEnd.getTime(),
    })

    expect(conversations).toEqual([{ date: dayStart.toISOString().slice(0, 10), value: 0 }])
  })

  it("getAvgUserQuestionsPerSessionPerDay should not leak data from other projects", async () => {
    const dayStart = new Date("2026-03-01T00:00:00.000Z")
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

    const otherAgentSettings = agentSettingsFactory
      .transient({ organization: otherOrganization, project: otherProject, agent: otherAgent })
      .build()
    await repositories.agentSettingsRepository.save(otherAgentSettings)

    const leakedSession = conversationAgentSessionFactory
      .transient({
        organization: otherOrganization,
        project: otherProject,
        agent: otherAgent,
        user: otherUser,
      })
      .build({ createdAt: hours(1).after(dayStart), updatedAt: new Date() })
    await repositories.conversationAgentSessionRepository.save(leakedSession)

    const leakedUserMessages = Array.from({ length: 3 }, (_unusedValue, messageIndex) =>
      agentMessageFactory
        .user()
        .transient({
          organization: otherOrganization,
          project: otherProject,
          session: leakedSession,
          agentSettings: otherAgentSettings,
        })
        .build({
          createdAt: minutes((messageIndex + 1) * 5).after(dayStart),
          agentSettingsId: otherAgentSettings.id,
        }),
    )
    await repositories.agentMessageRepository.save(leakedUserMessages)

    const targetConnectScope = {
      organizationId: targetOrganization.id,
      projectId: targetProject.id,
      userId: targetUser.id,
    }

    const averages = await service.getAvgUserQuestionsPerSessionPerDay({
      connectScope: targetConnectScope,
      startAt: dayStart.getTime(),
      endAt: dayEnd.getTime(),
    })

    expect(averages).toEqual([{ date: dayStart.toISOString().slice(0, 10), value: 0 }])
  })

  it("returns conversations by category per day split by agent", async () => {
    const day1Start = new Date("2026-05-01T00:00:00.000Z")
    const day2Start = days(1).after(day1Start)
    const day2End = endOfUtcDay(day2Start)

    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const supportAgent = agentFactory
      .transient({ organization, project })
      .build({ name: "Support" })
    const salesAgent = agentFactory.transient({ organization, project }).build({ name: "Sales" })
    await repositories.agentRepository.save([supportAgent, salesAgent])

    const billingCategory = await setup
      .getRepository(AgentSessionCategory)
      .save({ agentId: supportAgent.id, name: "billing" })
    const onboardingCategory = await setup
      .getRepository(AgentSessionCategory)
      .save({ agentId: salesAgent.id, name: "onboarding" })

    const supportDay1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: supportAgent, user })
      .build({ createdAt: hours(1).after(day1Start), updatedAt: new Date() })
    const supportDay2Uncategorized = conversationAgentSessionFactory
      .transient({ organization, project, agent: supportAgent, user })
      .build({ createdAt: hours(1).after(day2Start), updatedAt: new Date() })
    const salesDay2 = conversationAgentSessionFactory
      .transient({ organization, project, agent: salesAgent, user })
      .build({ createdAt: hours(2).after(day2Start), updatedAt: new Date() })
    await repositories.conversationAgentSessionRepository.save([
      supportDay1,
      supportDay2Uncategorized,
      salesDay2,
    ])

    await setup.getRepository(ConversationAgentSessionCategory).save([
      { conversationAgentSessionId: supportDay1.id, agentSessionCategoryId: billingCategory.id },
      { conversationAgentSessionId: salesDay2.id, agentSessionCategoryId: onboardingCategory.id },
    ])

    const connectScope = { organizationId: organization.id, projectId: project.id, userId: user.id }
    const supportPoints = await service.getConversationsByCategoryPerAgentPerDay({
      connectScope,
      agentId: supportAgent.id,
      startAt: day1Start.getTime(),
      endAt: day2End.getTime(),
    })

    expect(supportPoints).toEqual([
      {
        date: day1Start.toISOString().slice(0, 10),
        agentId: supportAgent.id,
        agentName: "Support",
        categoryId: billingCategory.id,
        categoryName: "billing",
        value: 1,
        isUncategorized: false,
      },
      {
        date: day2Start.toISOString().slice(0, 10),
        agentId: supportAgent.id,
        agentName: "Support",
        categoryName: "uncategorized",
        value: 1,
        isUncategorized: true,
      },
    ])

    const salesPoints = await service.getConversationsByCategoryPerAgentPerDay({
      connectScope,
      agentId: salesAgent.id,
      startAt: day1Start.getTime(),
      endAt: day2End.getTime(),
    })

    expect(salesPoints).toEqual([
      {
        date: day2Start.toISOString().slice(0, 10),
        agentId: salesAgent.id,
        agentName: "Sales",
        categoryId: onboardingCategory.id,
        categoryName: "onboarding",
        value: 1,
        isUncategorized: false,
      },
    ])

    const allAgentPoints = await service.getConversationsByCategoryPerAgentPerDay({
      connectScope,
      startAt: day1Start.getTime(),
      endAt: day2End.getTime(),
    })

    expect(allAgentPoints).toEqual([
      {
        date: day1Start.toISOString().slice(0, 10),
        agentId: supportAgent.id,
        agentName: "Support",
        categoryId: billingCategory.id,
        categoryName: "billing",
        value: 1,
        isUncategorized: false,
      },
      {
        date: day2Start.toISOString().slice(0, 10),
        agentId: salesAgent.id,
        agentName: "Sales",
        categoryId: onboardingCategory.id,
        categoryName: "onboarding",
        value: 1,
        isUncategorized: false,
      },
      {
        date: day2Start.toISOString().slice(0, 10),
        agentId: supportAgent.id,
        agentName: "Support",
        categoryName: "uncategorized",
        value: 1,
        isUncategorized: true,
      },
    ])
  })
})
