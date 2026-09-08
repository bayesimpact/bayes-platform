import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import {
  agentMessageFactory,
  createChitChatConversation,
} from "../../shared/agent-session-messages/agent-messages.factory"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("listMessagesForSession", () => {
  it("should return messages when user is a member of the organization", async () => {
    const {
      service,
      testAgentSettings,
      testUser,
      testOrganization,
      repositories,
      agentMessageRepository,
      testProject,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .transient({ organization: testOrganization, user: testUser })
        .owner()
        .build(),
    })

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    await createChitChatConversation(testOrganization, testProject, session, testAgentSettings, {
      agentMessageRepository,
    })

    const messages = await service.listMessagesForSession({
      agentSessionId: session.id,
      connectScope,
    })

    expect(messages).toHaveLength(2)
    expect(messages[0]?.role).toBe("user")
    expect(messages[0]?.content).toBe("Hello")
    expect(messages[1]?.role).toBe("assistant")
    expect(messages[1]?.content).toBe("Hi!")
  })
})

describe("stale streaming recovery", () => {
  const buildContext = async () => {
    const {
      service,
      testAgentSettings,
      testUser,
      testOrganization,
      repositories,
      agentMessageRepository,
      testProject,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .transient({ organization: testOrganization, user: testUser })
        .owner()
        .build(),
    })

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    const buildStreamingMessage = (minutesAgo: number) =>
      agentMessageFactory
        .assistant()
        .streaming()
        .sentMinutesAgo(minutesAgo)
        .transient({
          organization: testOrganization,
          project: testProject,
          session,
          agentSettings: testAgentSettings,
        })
        .build({ content: "" })

    return { service, connectScope, session, agentMessageRepository, buildStreamingMessage }
  }

  describe("listMessagesForSession", () => {
    it("marks a streaming message whose stream is long gone as aborted", async () => {
      // A page refresh mid-reply closes the stream; if the server also went away, the
      // assistant message stays "streaming" for good. Listing must not hand that back as live.
      const { service, connectScope, session, agentMessageRepository, buildStreamingMessage } =
        await buildContext()
      const staleMessage = await agentMessageRepository.save(buildStreamingMessage(10))

      const messages = await service.listMessagesForSession({
        agentSessionId: session.id,
        connectScope,
      })

      expect(messages.find((message) => message.id === staleMessage.id)?.status).toBe("aborted")
      const persisted = await agentMessageRepository.findOneBy({ id: staleMessage.id })
      expect(persisted?.status).toBe("aborted")
    })

    it("leaves a message that may still be streaming alone", async () => {
      const { service, connectScope, session, agentMessageRepository, buildStreamingMessage } =
        await buildContext()
      const recentMessage = await agentMessageRepository.save(buildStreamingMessage(1))

      const messages = await service.listMessagesForSession({
        agentSessionId: session.id,
        connectScope,
      })

      expect(messages.find((message) => message.id === recentMessage.id)?.status).toBe("streaming")
    })
  })

  describe("getMessageById", () => {
    it("marks a streaming message whose stream is long gone as aborted", async () => {
      // The client polls this endpoint after a refresh until the message settles, so a stale
      // stream must settle here too or the poll never ends.
      const { service, connectScope, agentMessageRepository, buildStreamingMessage, session } =
        await buildContext()
      const staleMessage = await agentMessageRepository.save(buildStreamingMessage(10))

      const message = await service.getMessageById({
        id: staleMessage.id,
        agentSessionId: session.id,
        connectScope,
      })

      expect(message?.status).toBe("aborted")
      const persisted = await agentMessageRepository.findOneBy({ id: staleMessage.id })
      expect(persisted?.status).toBe("aborted")
    })

    it("leaves a message that may still be streaming alone", async () => {
      const { service, connectScope, agentMessageRepository, buildStreamingMessage, session } =
        await buildContext()
      const recentMessage = await agentMessageRepository.save(buildStreamingMessage(1))

      const message = await service.getMessageById({
        id: recentMessage.id,
        agentSessionId: session.id,
        connectScope,
      })

      expect(message?.status).toBe("streaming")
    })

    it("does not see, nor settle, a message of another session", async () => {
      // The endpoint is polled with ids the client holds. An id from another session must not
      // flip that session's live reply to aborted through this read.
      const { service, connectScope, agentMessageRepository, buildStreamingMessage, session } =
        await buildContext()
      const staleMessage = await agentMessageRepository.save(buildStreamingMessage(10))
      const otherSession = await service.createSession({
        connectScope,
        agentSettingsId: staleMessage.agentSettingsId,
        userId: session.userId,
        type: "playground",
      })

      const message = await service.getMessageById({
        id: staleMessage.id,
        agentSessionId: otherSession.id,
        connectScope,
      })

      expect(message).toBeNull()
      const persisted = await agentMessageRepository.findOneBy({ id: staleMessage.id })
      expect(persisted?.status).toBe("streaming")
    })
  })
})
