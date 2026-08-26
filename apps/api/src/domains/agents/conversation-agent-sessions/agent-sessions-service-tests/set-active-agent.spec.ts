import { afterAll } from "@jest/globals"
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

    await service.setActiveAgent({ connectScope, sessionId: session.id, activeAgentId: childAgentId })
    const afterSet = await conversationAgentSessionRepository.findOne({ where: { id: session.id } })
    expect(afterSet?.activeAgentId).toBe(childAgentId)

    await service.clearActiveAgentIfCurrent({
      connectScope,
      sessionId: session.id,
      expectedActiveAgentId: childAgentId,
    })
    const afterClear = await conversationAgentSessionRepository.findOne({ where: { id: session.id } })
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

    await service.setActiveAgent({ connectScope, sessionId: session.id, activeAgentId: currentChildId })
    await service.clearActiveAgentIfCurrent({
      connectScope,
      sessionId: session.id,
      expectedActiveAgentId: staleChildId,
    })

    const persisted = await conversationAgentSessionRepository.findOne({ where: { id: session.id } })
    expect(persisted?.activeAgentId).toBe(currentChildId)
  })
})
