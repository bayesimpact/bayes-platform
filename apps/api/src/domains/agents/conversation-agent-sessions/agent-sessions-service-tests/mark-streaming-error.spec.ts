import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("markStreamingError", () => {
  it("should mark assistant message as error", async () => {
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

    const errorSession = await streamingLLMService.markStreamingError({
      sessionId: session.id,
      assistantMessageId,
      errorMessage: "An error occurred",
    })

    const errorMessage = errorSession.messages.find((msg) => msg.id === assistantMessageId)
    expect(errorMessage).toBeDefined()
    expect(errorMessage?.status).toBe("error")
    expect(errorMessage?.content).toBe("An error occurred")
    expect(errorMessage?.completedAt).toBeDefined()
  })
})
