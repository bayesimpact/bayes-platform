import { afterAll } from "@jest/globals"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentMessageFactory } from "../../shared/agent-session-messages/agent-messages.factory"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("findById", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })
  it("should find an existing session", async () => {
    const {
      service,
      testAgentSettings,
      testOrganization,
      testUser,
      testProject,
      streamingService,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }
    const createdSession = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    const foundSession = await streamingService.findSessionById({
      sessionId: createdSession.id,
    })

    expect(foundSession).toBeDefined()
    expect(foundSession?.id).toBe(createdSession.id)
    expect(foundSession?.type).toBe("playground")
  })

  it("should return null for non-existent session", async () => {
    const { streamingService } = getTestContext()

    // Use a valid UUID format for non-existent session
    const nonExistentId = "00000000-0000-0000-0000-000000000000"
    const foundSession = await streamingService.findSessionById({
      sessionId: nonExistentId,
    })

    expect(foundSession).toBeNull()
  })

  it("should recover aborted streams on load", async () => {
    const {
      service,
      testAgentSettings,
      testOrganization,
      testUser,
      agentMessageRepository,
      testProject,
      streamingService,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    // Create a session with an old streaming message
    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    // Manually add an old streaming message (simulating a crash)
    const oldDate = new Date()
    oldDate.setMinutes(oldDate.getMinutes() - 10) // 10 minutes ago

    const oldMessage = agentMessageFactory
      .streaming()
      .sentMinutesAgo(10)
      .assistant()
      .transient({
        organization: testOrganization,
        project: testProject,
        session: session,
        agentSettings: testAgentSettings,
      })
      .build()
    await agentMessageRepository.save(oldMessage)

    // Load the session - should recover the aborted stream
    const loadedSession = await streamingService.findSessionById({
      sessionId: session.id,
    })

    expect(loadedSession).toBeDefined()
    const recoveredMessage = await agentMessageRepository.findOne({
      where: { id: oldMessage.id },
    })
    expect(recoveredMessage).toBeDefined()
    expect(recoveredMessage?.status).toBe("aborted")
  })
})
