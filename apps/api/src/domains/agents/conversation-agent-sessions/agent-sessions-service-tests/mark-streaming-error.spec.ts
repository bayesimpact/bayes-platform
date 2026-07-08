import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("markStreamingError", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })
  it("should mark assistant message as error", async () => {
    const { service, testAgent, testOrganization, testUser, testProject, streamingService } =
      getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const session = await service.createSession({
      connectScope,
      agentId: testAgent.id,
      userId: testUser.id,
      type: "playground",
    })

    const { assistantMessageId } = await streamingService.prepareForStreaming({
      agentSessionScope: { agent: testAgent, session, connectScope },
      userContent: "Hello",
      agentType: testAgent.type,
    })

    const errorSession = await streamingService.markStreamingError({
      sessionId: session.id,
      assistantMessageId,
      errorMessage: "An error occurred",
      agentType: testAgent.type,
    })

    const errorMessage = errorSession.messages.find((msg) => msg.id === assistantMessageId)
    expect(errorMessage).toBeDefined()
    expect(errorMessage?.status).toBe("error")
    expect(errorMessage?.content).toBe("An error occurred")
    expect(errorMessage?.completedAt).toBeDefined()
  })
})
