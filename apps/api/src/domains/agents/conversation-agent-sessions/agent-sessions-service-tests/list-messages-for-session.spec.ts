import { afterAll } from "@jest/globals"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { createChitChatConversation } from "../../shared/agent-session-messages/agent-messages.factory"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("listMessagesForSession", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })
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

  it("merges a handoff sub-session's messages into the parent transcript", async () => {
    const {
      service,
      testAgentSettings,
      testUser,
      testOrganization,
      testProject,
      agentMessageRepository,
    } = getTestContext()
    const connectScope: RequiredConnectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const parentSession = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })
    await createChitChatConversation(
      testOrganization,
      testProject,
      parentSession,
      testAgentSettings,
      { agentMessageRepository },
    )

    const childSession = await service.findOrCreateSubSession({
      connectScope,
      agentId: testAgentSettings.agentId,
      userId: testUser.id,
      parentSessionId: parentSession.id,
      type: "playground",
    })
    await createChitChatConversation(
      testOrganization,
      testProject,
      childSession,
      testAgentSettings,
      { agentMessageRepository },
      {
        userMessage: { content: "How is it going?" },
        assistantMessage: { content: "All good!" },
      },
    )

    const messages = await service.listMessagesForSession({
      agentSessionId: parentSession.id,
      connectScope,
    })

    expect(messages).toHaveLength(4)
    expect(messages.map((message) => message.content)).toEqual([
      "Hello",
      "Hi!",
      "How is it going?",
      "All good!",
    ])
  })
})
