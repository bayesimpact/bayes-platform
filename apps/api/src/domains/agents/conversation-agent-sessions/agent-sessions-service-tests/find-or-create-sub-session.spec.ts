import { afterAll } from "@jest/globals"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

const PARENT_SESSION_ID = "11111111-1111-1111-1111-111111111111"

describe("findOrCreateSubSession", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })

  it("creates a conversation sub-session marked as a sub-session and linked to the parent", async () => {
    const { service, testAgent, testOrganization, testProject, testUser } = getTestContext()

    const session = await service.findOrCreateSubSession({
      connectScope: { organizationId: testOrganization.id, projectId: testProject.id },
      agentId: testAgent.id,
      userId: testUser.id,
      parentSessionId: PARENT_SESSION_ID,
      type: "playground",
    })

    expect(session.isSubSession).toBe(true)
    expect(session.parentSessionId).toBe(PARENT_SESSION_ID)
    expect(session.agentId).toBe(testAgent.id)
    expect(session.userId).toBe(testUser.id)
    expect(session.type).toBe("playground")
  })

  it("reuses the existing sub-session for the same parent session and conversation agent", async () => {
    const { service, testAgent, testOrganization, testProject, testUser } = getTestContext()
    const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }

    const first = await service.findOrCreateSubSession({
      connectScope,
      agentId: testAgent.id,
      userId: testUser.id,
      parentSessionId: PARENT_SESSION_ID,
      type: "playground",
    })
    const second = await service.findOrCreateSubSession({
      connectScope,
      agentId: testAgent.id,
      userId: testUser.id,
      parentSessionId: PARENT_SESSION_ID,
      type: "playground",
    })

    expect(second.id).toBe(first.id)
  })

  it("excludes sub-sessions from the user-facing session list", async () => {
    const {
      service,
      testAgent,
      testOrganization,
      testProject,
      testUser,
      conversationAgentSessionRepository,
    } = getTestContext()
    const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }

    const userSession = conversationAgentSessionFactory
      .transient({
        organization: testOrganization,
        project: testProject,
        agent: testAgent,
        user: testUser,
      })
      .playground()
      .build()
    await conversationAgentSessionRepository.save(userSession)

    await service.findOrCreateSubSession({
      connectScope,
      agentId: testAgent.id,
      userId: testUser.id,
      parentSessionId: PARENT_SESSION_ID,
      type: "playground",
    })

    const listed = await service.getAllSessionsForAgent({
      connectScope,
      agentId: testAgent.id,
      userId: testUser.id,
      type: "playground",
    })

    expect(listed.map((session) => session.id)).toEqual([userSession.id])
  })
})
