import { afterAll } from "@jest/globals"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("createSession", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })
  it("should create a live session", async () => {
    const {
      service,
      testAgent,
      testAgentSettings,
      testUser,
      testOrganization,
      organizationMembershipRepository,
      testProject,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const membership = organizationMembershipFactory
      .transient({ user: testUser, organization: testOrganization })
      .member()
      .build()
    await organizationMembershipRepository.save(membership)

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "live",
    })

    expect(session).toBeDefined()
    expect(session.type).toBe("live")
    expect(session.agentId).toBe(testAgent.id)
    expect(session.userId).toBe(testUser.id)
    expect(session.organizationId).toBe(testOrganization.id)
    expect(session.messages).toBeUndefined()
    expect(session.expiresAt).toBeNull()
  })
  it("should create a playground session", async () => {
    const {
      service,
      testAgent,
      testAgentSettings,
      testUser,
      testOrganization,
      organizationMembershipRepository,
      testProject,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const membership = organizationMembershipFactory
      .transient({ user: testUser, organization: testOrganization })
      .member()
      .build()
    await organizationMembershipRepository.save(membership)

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    expect(session).toBeDefined()
    expect(session.type).toBe("playground")
    expect(session.agentId).toBe(testAgent.id)
    expect(session.userId).toBe(testUser.id)
    expect(session.organizationId).toBe(testOrganization.id)
    expect(session.messages).toBeUndefined()
    expect(session.expiresAt).toBeNull()
  })

  it("should seed an assistant message when the agent has a greetingMessage", async () => {
    const {
      service,
      testUser,
      testOrganization,
      testProject,
      agentRepository,
      agentSettingsRepository,
      agentMessageRepository,
      organizationMembershipRepository,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const membership = organizationMembershipFactory
      .transient({ user: testUser, organization: testOrganization })
      .member()
      .build()
    await organizationMembershipRepository.save(membership)

    const greeting = "Hi! How can I help you today?"
    const agentWithGreeting = await agentRepository.save(
      agentRepository.create(
        agentFactory.transient({ organization: testOrganization, project: testProject }).build(),
      ),
    )
    const agentSettingsWithGreeting = await agentSettingsRepository.save(
      agentSettingsRepository.create(
        agentSettingsFactory
          .transient({
            organization: testOrganization,
            project: testProject,
            agent: agentWithGreeting,
          })
          .build({ greetingMessage: greeting }),
      ),
    )

    const session = await service.createSession({
      connectScope,
      agentSettingsId: agentSettingsWithGreeting.id,
      userId: testUser.id,
      type: "live",
    })

    const messages = await agentMessageRepository.find({ where: { sessionId: session.id } })
    expect(messages).toHaveLength(1)
    const [seeded] = messages
    expect(seeded!.role).toBe("assistant")
    expect(seeded!.content).toBe(greeting)
    expect(seeded!.status).toBe("completed")
  })

  it("should not seed any message when the agent has no greetingMessage", async () => {
    const {
      service,
      testAgentSettings,
      testUser,
      testOrganization,
      testProject,
      agentMessageRepository,
      organizationMembershipRepository,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const membership = organizationMembershipFactory
      .transient({ user: testUser, organization: testOrganization })
      .member()
      .build()
    await organizationMembershipRepository.save(membership)

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "live",
    })

    const messages = await agentMessageRepository.find({ where: { sessionId: session.id } })
    expect(messages).toHaveLength(0)
  })

  it("should not seed a message when the stored greetingMessage is only whitespace", async () => {
    const {
      service,
      testUser,
      testOrganization,
      testProject,
      agentRepository,
      agentSettingsRepository,
      agentMessageRepository,
      organizationMembershipRepository,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const membership = organizationMembershipFactory
      .transient({ user: testUser, organization: testOrganization })
      .member()
      .build()
    await organizationMembershipRepository.save(membership)

    const whitespaceAgent = await agentRepository.save(
      agentRepository.create(
        agentFactory.transient({ organization: testOrganization, project: testProject }).build(),
      ),
    )
    const whitespaceAgentSettings = await agentSettingsRepository.save(
      agentSettingsRepository.create(
        agentSettingsFactory
          .transient({
            organization: testOrganization,
            project: testProject,
            agent: whitespaceAgent,
          })
          .build({ greetingMessage: "   \n   " }),
      ),
    )

    const session = await service.createSession({
      connectScope,
      agentSettingsId: whitespaceAgentSettings.id,
      userId: testUser.id,
      type: "live",
    })

    const messages = await agentMessageRepository.find({ where: { sessionId: session.id } })
    expect(messages).toHaveLength(0)
  })
})
