import { afterAll } from "@jest/globals"
import { agentFactory } from "@/domains/agents/agent.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("setActiveAgent / clearActiveAgentIfCurrent", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })

  it("sets and then clears a session's active agent", async () => {
    const {
      service,
      testAgentSettings,
      testOrganization,
      testProject,
      testUser,
      conversationAgentSessionRepository,
    } = getTestContext()
    const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })
    const childAgentId = "11111111-1111-1111-1111-111111111111"

    await service.setActiveAgent({
      connectScope,
      sessionId: session.id,
      activeAgentId: childAgentId,
    })
    const afterSet = await conversationAgentSessionRepository.findOne({ where: { id: session.id } })
    expect(afterSet?.activeAgentId).toBe(childAgentId)

    await service.clearActiveAgentIfCurrent({
      connectScope,
      sessionId: session.id,
      expectedActiveAgentId: childAgentId,
    })
    const afterClear = await conversationAgentSessionRepository.findOne({
      where: { id: session.id },
    })
    expect(afterClear?.activeAgentId).toBeNull()
  })

  it("does not clear the active agent when it no longer matches the expected one", async () => {
    const {
      service,
      testAgentSettings,
      testOrganization,
      testProject,
      testUser,
      conversationAgentSessionRepository,
    } = getTestContext()
    const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })
    const staleChildId = "11111111-1111-1111-1111-111111111111"
    const currentChildId = "22222222-2222-2222-2222-222222222222"

    await service.setActiveAgent({
      connectScope,
      sessionId: session.id,
      activeAgentId: currentChildId,
    })
    await service.clearActiveAgentIfCurrent({
      connectScope,
      sessionId: session.id,
      expectedActiveAgentId: staleChildId,
    })

    const persisted = await conversationAgentSessionRepository.findOne({
      where: { id: session.id },
    })
    expect(persisted?.activeAgentId).toBe(currentChildId)
  })

  it("auto-advances to nextChildAgentId instead of clearing when a handoff link configures one", async () => {
    const {
      service,
      testAgent,
      testAgentSettings,
      testOrganization,
      testProject,
      testUser,
      conversationAgentSessionRepository,
      agentRepository,
      agentSubAgentRepository,
    } = getTestContext()
    const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }

    const childAgentB = await agentRepository.save(
      agentRepository.create(
        agentFactory
          .transient({ organization: testOrganization, project: testProject })
          .build({ name: "Child B" }),
      ),
    )
    const childAgentC = await agentRepository.save(
      agentRepository.create(
        agentFactory
          .transient({ organization: testOrganization, project: testProject })
          .build({ name: "Child C" }),
      ),
    )
    await agentSubAgentRepository.save(
      agentSubAgentRepository.create({
        parentAgentId: testAgent.id,
        childAgentId: childAgentB.id,
        toolName: "ask_child_b",
        description: "",
        enabled: true,
        mode: "handoff",
        nextChildAgentId: childAgentC.id,
      }),
    )

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    await service.setActiveAgent({
      connectScope,
      sessionId: session.id,
      activeAgentId: childAgentB.id,
    })
    await service.clearActiveAgentIfCurrent({
      connectScope,
      sessionId: session.id,
      expectedActiveAgentId: childAgentB.id,
    })

    const persisted = await conversationAgentSessionRepository.findOne({
      where: { id: session.id },
    })
    expect(persisted?.activeAgentId).toBe(childAgentC.id)

    const subSessionForC = await conversationAgentSessionRepository.findOne({
      where: { agentId: childAgentC.id, parentSessionId: session.id },
    })
    expect(subSessionForC).not.toBeNull()
  })
})
