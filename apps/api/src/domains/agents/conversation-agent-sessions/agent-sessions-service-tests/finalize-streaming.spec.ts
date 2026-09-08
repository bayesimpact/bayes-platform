import { NotFoundException } from "@nestjs/common/exceptions"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("finalizeStreaming", () => {
  it("should update assistant message with content and completed status", async () => {
    const {
      service,
      testAgent,
      testAgentSettings,
      testOrganization,
      testUser,
      testProject,
      streamingLLMService,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }
    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    const { assistantMessageId } = await streamingLLMService.prepareForStreaming({
      agentSessionScope: {
        agent: testAgent,
        agentSettings: testAgentSettings,
        session,
        connectScope,
      },
      userContent: "Hello",
    })

    const finalizedSession = await streamingLLMService.finalizeStreaming({
      sessionId: session.id,
      assistantMessageId,
      fullContent: "Hello! How can I help you today?",
    })

    const assistantMessage = finalizedSession.messages.find((msg) => msg.id === assistantMessageId)
    expect(assistantMessage).toBeDefined()
    expect(assistantMessage?.content).toBe("Hello! How can I help you today?")
    expect(assistantMessage?.status).toBe("completed")
    expect(assistantMessage?.completedAt).toBeDefined()
  })

  it("should throw NotFoundException for non-existent session", async () => {
    const { streamingLLMService } = getTestContext()

    // Use a valid UUID format for non-existent session
    const nonExistentId = "00000000-0000-0000-0000-000000000000"
    await expect(
      streamingLLMService.finalizeStreaming({
        sessionId: nonExistentId,
        assistantMessageId: "00000000-0000-0000-0000-000000000001",
        fullContent: "Content",
      }),
    ).rejects.toThrow(NotFoundException)
  })
})
