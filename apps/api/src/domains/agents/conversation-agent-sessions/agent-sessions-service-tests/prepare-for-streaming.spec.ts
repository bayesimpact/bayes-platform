import { afterAll } from "@jest/globals"
import { NotFoundException } from "@nestjs/common/exceptions"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("prepareForStreaming", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })
  it("should persist user message and empty assistant message", async () => {
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

    const { session: updatedSession, assistantMessageId } =
      await streamingService.prepareForStreaming({
        agentSessionScope: { agent: testAgent, session, connectScope },
        userContent: "Hello, how are you?",
        agentType: testAgent.type,
      })

    expect(updatedSession.messages).toHaveLength(2)
    const userMessage = updatedSession.messages[0]!
    const assistantMessage = updatedSession.messages[1]!
    expect(userMessage).toBeDefined()
    expect(assistantMessage).toBeDefined()
    expect(userMessage.role).toBe("user")
    expect(userMessage.content).toBe("Hello, how are you?")
    expect(assistantMessage.role).toBe("assistant")
    expect(assistantMessage.status).toBe("streaming")
    expect(assistantMessage.content).toBe("")
    expect(assistantMessage.id).toBe(assistantMessageId)
    expect(assistantMessage.startedAt).toBeDefined()
  })

  it("should throw NotFoundException for non-existent session", async () => {
    const { testOrganization, testProject, streamingService, testAgent } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    // Use a valid UUID format for non-existent session
    const nonExistentId = "00000000-0000-0000-0000-000000000000"
    const session = {
      id: nonExistentId,
      traceId: nonExistentId,
      organizationId: testOrganization.id,
      messages: [],
    }
    await expect(
      streamingService.prepareForStreaming({
        agentSessionScope: { agent: testAgent, session: session as never, connectScope },
        userContent: "Hello",
        agentType: testAgent.type,
      }),
    ).rejects.toThrow(NotFoundException)
  })
})
