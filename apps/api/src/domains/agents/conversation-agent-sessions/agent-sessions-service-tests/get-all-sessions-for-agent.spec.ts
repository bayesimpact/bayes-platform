import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { userFactory } from "@/domains/users/user.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("getAllSessionsForAgent", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })
  describe("type: live", () => {
    it("should return all sessions for a agent and user ordered by createdAt DESC", async () => {
      const {
        service,
        testAgent,
        testOrganization,
        testUser,
        conversationAgentSessionRepository,
        testProject,
      } = getTestContext()

      const buildAgent = (params: { date: Date; type: BaseAgentSessionTypeDto }) =>
        conversationAgentSessionFactory
          .transient({
            organization: testOrganization,
            project: testProject,
            agent: testAgent,
            user: testUser,
          })
          .live()
          .build(params)

      // Create multiple sessions with different timestamps
      const liveSession = buildAgent({
        date: new Date("2026-01-15T10:00:00Z"),
        type: "live",
      })
      const playgroundSession = buildAgent({
        date: new Date("2026-01-30T10:00:00Z"),
        type: "playground",
      })

      await conversationAgentSessionRepository.save([liveSession, playgroundSession])

      const sessions = await service.getAllSessionsForAgent({
        connectScope: {
          organizationId: testOrganization.id,
          projectId: testProject.id,
        },
        agentId: testAgent.id,
        userId: testUser.id,
        type: "live",
      })

      expect(sessions).toHaveLength(1)
      expect(sessions[0]?.id).toBe(liveSession.id)
    })
  })

  describe("type: playground", () => {
    it("should return all sessions for a agent and user ordered by createdAt DESC", async () => {
      const {
        service,
        testAgent,
        testOrganization,
        testUser,
        conversationAgentSessionRepository,
        testProject,
      } = getTestContext()

      const buildAgent = (params: { date: Date; type: BaseAgentSessionTypeDto }) =>
        conversationAgentSessionFactory
          .transient({
            organization: testOrganization,
            project: testProject,
            agent: testAgent,
            user: testUser,
          })
          .playground()
          .build(params)

      // Create multiple sessions with different timestamps
      const liveSession = buildAgent({
        date: new Date("2026-01-15T10:00:00Z"),
        type: "live",
      })
      const playgroundSession = buildAgent({
        date: new Date("2026-01-30T10:00:00Z"),
        type: "playground",
      })

      await conversationAgentSessionRepository.save([liveSession, playgroundSession])

      const sessions = await service.getAllSessionsForAgent({
        connectScope: {
          organizationId: testOrganization.id,
          projectId: testProject.id,
        },
        agentId: testAgent.id,
        userId: testUser.id,
        type: "playground",
      })

      expect(sessions).toHaveLength(1)
      expect(sessions[0]?.id).toBe(playgroundSession.id)
    })
  })

  it("should return only sessions for the specific agent", async () => {
    const {
      service,
      testAgent,
      testUser,
      agentRepository,
      agentSettingsRepository,
      conversationAgentSessionRepository,
      testProject,
      testOrganization,
    } = getTestContext()

    // Create another agent
    const anotherAgent = agentFactory
      .transient({ organization: testOrganization, project: testProject })
      .build({
        name: "Another Agent",
      })
    await agentRepository.save(anotherAgent)

    const anotherAgentSettings = agentSettingsFactory
      .transient({ organization: testOrganization, project: testProject, agent: anotherAgent })
      .build()
    await agentSettingsRepository.save(anotherAgentSettings)

    // Create sessions for both agents
    const session1 = conversationAgentSessionFactory
      .transient({
        organization: testOrganization,
        project: testProject,
        agent: testAgent,
        user: testUser,
      })
      .live()
      .build()

    const session2 = conversationAgentSessionFactory
      .transient({
        organization: testOrganization,
        project: testProject,
        agent: anotherAgent,
        user: testUser,
      })
      .build()

    await conversationAgentSessionRepository.save([session1, session2])

    const sessions = await service.getAllSessionsForAgent({
      connectScope: {
        organizationId: testOrganization.id,
        projectId: testProject.id,
      },
      agentId: testAgent.id,
      userId: testUser.id,
      type: "live",
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.agentId).toBe(testAgent.id)
  })

  it("should return only sessions for the specific user", async () => {
    const {
      service,
      testAgent,
      testOrganization,
      testUser,
      userRepository,
      conversationAgentSessionRepository,
      testProject,
    } = getTestContext()

    // Create another user
    const anotherUser = userFactory.build({
      email: "another@example.com",
    })
    await userRepository.save(anotherUser)

    // Create sessions for both users
    const session1 = conversationAgentSessionFactory
      .transient({
        organization: testOrganization,
        project: testProject,
        agent: testAgent,
        user: testUser,
      })
      .live()
      .build()

    const session2 = conversationAgentSessionFactory
      .transient({
        organization: testOrganization,
        project: testProject,
        agent: testAgent,
        user: anotherUser,
      })
      .live()
      .build()

    await conversationAgentSessionRepository.save([session1, session2])

    const sessions = await service.getAllSessionsForAgent({
      connectScope: {
        organizationId: testOrganization.id,
        projectId: testProject.id,
      },
      agentId: testAgent.id,
      userId: testUser.id,
      type: "live",
    })

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.userId).toBe(testUser.id)
  })

  it("should return empty array when no sessions exist", async () => {
    const { service, testAgent, testUser, testOrganization, testProject } = getTestContext()

    const sessions = await service.getAllSessionsForAgent({
      connectScope: {
        organizationId: testOrganization.id,
        projectId: testProject.id,
      },
      agentId: testAgent.id,
      userId: testUser.id,
      type: "live",
    })

    expect(sessions).toEqual([])
  })
})
