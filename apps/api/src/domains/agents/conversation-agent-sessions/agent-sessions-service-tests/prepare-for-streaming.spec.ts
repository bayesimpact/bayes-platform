import { NotFoundException, UnprocessableEntityException } from "@nestjs/common/exceptions"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { agentMessageAttachmentDocumentFactory } from "../../shared/agent-session-messages/agent-message-attachment-document.factory"
import { agentMessageFactory } from "../../shared/agent-session-messages/agent-messages.factory"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("prepareForStreaming", () => {
  it("should persist user message and empty assistant message", async () => {
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

    const { session: updatedSession, assistantMessageId } =
      await streamingLLMService.prepareForStreaming({
        agentSessionScope: {
          agent: testAgent,
          agentSettings: testAgentSettings,
          session,
          connectScope,
        },
        userContent: "Hello, how are you?",
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

  describe("attachment", () => {
    const buildContext = async () => {
      const {
        service,
        testAgent,
        testAgentSettings,
        testOrganization,
        testUser,
        testProject,
        streamingLLMService,
        repositories,
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
      const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.save(
        agentMessageAttachmentDocumentFactory
          .transient({ organization: testOrganization, project: testProject })
          .build({ pdfPageCount: 3 }),
      )
      const agentSessionScope = {
        agent: testAgent,
        agentSettings: testAgentSettings,
        session,
        connectScope,
      }
      const attachToMessageOf = (attachedSession: typeof session) =>
        repositories.agentMessageRepository.save(
          agentMessageFactory
            .user()
            .transient({
              organization: testOrganization,
              project: testProject,
              session: attachedSession,
              agentSettings: testAgentSettings,
            })
            .build({ attachmentDocumentId: attachmentDocument.id }),
        )
      return {
        service,
        streamingLLMService,
        repositories,
        attachmentDocument,
        agentSessionScope,
        session,
        connectScope,
        testAgentSettings,
        testUser,
        attachToMessageOf,
      }
    }

    it("attaches a fresh document as is", async () => {
      const { streamingLLMService, attachmentDocument, agentSessionScope } = await buildContext()

      const { session: updatedSession, attachmentDocumentId } =
        await streamingLLMService.prepareForStreaming({
          agentSessionScope,
          userContent: "What is in this file?",
          attachmentDocumentId: attachmentDocument.id,
        })

      expect(attachmentDocumentId).toBe(attachmentDocument.id)
      expect(updatedSession.messages[0]?.attachmentDocumentId).toBe(attachmentDocument.id)
    })

    it("attaches a copy when the document already belongs to an earlier turn", async () => {
      // Resending an interrupted turn reuses its attachment, but a document row can only be
      // attached to one message. The new turn gets its own row pointing at the same stored file.
      const {
        streamingLLMService,
        repositories,
        attachmentDocument,
        agentSessionScope,
        session,
        attachToMessageOf,
      } = await buildContext()
      await attachToMessageOf(session)

      const { session: updatedSession, attachmentDocumentId } =
        await streamingLLMService.prepareForStreaming({
          agentSessionScope,
          userContent: "What is in this file?",
          attachmentDocumentId: attachmentDocument.id,
        })

      expect(attachmentDocumentId).toBeDefined()
      expect(attachmentDocumentId).not.toBe(attachmentDocument.id)
      const resentUserMessage = updatedSession.messages.find(
        (message) => message.role === "user" && message.content === "What is in this file?",
      )
      expect(resentUserMessage?.attachmentDocumentId).toBe(attachmentDocumentId)

      const copy = await repositories.agentMessageAttachmentDocumentRepository.findOneBy({
        id: attachmentDocumentId,
      })
      expect(copy).toMatchObject({
        organizationId: attachmentDocument.organizationId,
        projectId: attachmentDocument.projectId,
        fileName: attachmentDocument.fileName,
        mimeType: attachmentDocument.mimeType,
        size: attachmentDocument.size,
        storageRelativePath: attachmentDocument.storageRelativePath,
        // Rendered pages are cached under the file path, so the copy never renders again.
        pdfPageCount: 3,
      })
    })

    it("rejects a document already attached in another conversation", async () => {
      // Only the conversation that uploaded a file may attach it again: an attachment id taken
      // by another conversation of the project must not be copied into this one.
      const {
        service,
        streamingLLMService,
        attachmentDocument,
        agentSessionScope,
        connectScope,
        testAgentSettings,
        testUser,
        attachToMessageOf,
      } = await buildContext()
      const otherSession = await service.createSession({
        connectScope,
        agentSettingsId: testAgentSettings.id,
        userId: testUser.id,
        type: "playground",
      })
      await attachToMessageOf(otherSession)

      await expect(
        streamingLLMService.prepareForStreaming({
          agentSessionScope,
          userContent: "What is in this file?",
          attachmentDocumentId: attachmentDocument.id,
        }),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  it("should throw NotFoundException for non-existent session", async () => {
    const { testOrganization, testProject, streamingLLMService, testAgent, testAgentSettings } =
      getTestContext()
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
      streamingLLMService.prepareForStreaming({
        agentSessionScope: {
          agent: testAgent,
          agentSettings: testAgentSettings,
          session: session as never,
          connectScope,
        },
        userContent: "Hello",
      }),
    ).rejects.toThrow(NotFoundException)
  })
})
