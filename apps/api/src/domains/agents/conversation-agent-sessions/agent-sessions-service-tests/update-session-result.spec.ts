import { afterAll } from "@jest/globals"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("updateSessionResult", () => {
  afterAll(async () => {
    await sdk.shutdown()
  })

  it("merges sequential partial updates into the session result", async () => {
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

    const firstUpdate = await service.updateSessionResult({
      connectScope,
      sessionId: session.id,
      input: { title: "Draft title" },
    })
    expect(firstUpdate.result).toEqual({ title: "Draft title" })

    const secondUpdate = await service.updateSessionResult({
      connectScope,
      sessionId: session.id,
      input: { summary: "A short summary" },
    })
    expect(secondUpdate.result).toEqual({ title: "Draft title", summary: "A short summary" })

    const persistedSession = await conversationAgentSessionRepository.findOne({
      where: { id: session.id },
    })
    expect(persistedSession?.result).toEqual({ title: "Draft title", summary: "A short summary" })
  })

  it("overwrites previously filled keys with the latest input", async () => {
    const { service, testAgentSettings, testOrganization, testProject, testUser } = getTestContext()
    const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    await service.updateSessionResult({
      connectScope,
      sessionId: session.id,
      input: { title: "Draft title", summary: "A short summary" },
    })
    const { result } = await service.updateSessionResult({
      connectScope,
      sessionId: session.id,
      input: { title: "Final title" },
    })

    expect(result).toEqual({ title: "Final title", summary: "A short summary" })
  })

  it("returns a null result for an unknown session", async () => {
    const { service, testOrganization, testProject } = getTestContext()
    const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }

    const { result } = await service.updateSessionResult({
      connectScope,
      sessionId: "00000000-0000-0000-0000-000000000000",
      input: { title: "Draft title" },
    })

    expect(result).toBeNull()
  })

  describe("handoff handback", () => {
    const buildChildAgentAndSettings = async ({
      testOrganization,
      testProject,
      agentRepository,
      agentSettingsRepository,
    }: ReturnType<typeof getTestContext>) => {
      const childAgent = await agentRepository.save(
        agentFactory
          .transient({ organization: testOrganization, project: testProject })
          .build({ name: `Child Agent ${Date.now()}`, type: "conversation" }),
      )
      await agentSettingsRepository.save(
        agentSettingsFactory
          .transient({ organization: testOrganization, project: testProject, agent: childAgent })
          .build({
            fillFormEnabled: true,
            outputJsonSchema: {
              type: "object",
              required: ["symptom"],
              properties: { symptom: { type: "string" } },
            },
          }),
      )
      return { childAgent }
    }

    it("clears the parent's active agent once the handoff child's required fields are all filled", async () => {
      const context = getTestContext()
      const { service, testAgentSettings, testOrganization, testProject, testUser } = context
      const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }
      const { childAgent } = await buildChildAgentAndSettings(context)

      const parentSession = await service.createSession({
        connectScope,
        agentSettingsId: testAgentSettings.id,
        userId: testUser.id,
        type: "playground",
      })
      const childSession = await service.findOrCreateSubSession({
        connectScope,
        agentId: childAgent.id,
        userId: testUser.id,
        parentSessionId: parentSession.id,
        type: "playground",
      })
      await service.setActiveAgent({
        connectScope,
        sessionId: parentSession.id,
        activeAgentId: childAgent.id,
      })

      await service.updateSessionResult({
        connectScope,
        sessionId: childSession.id,
        input: { symptom: "dizziness" },
      })

      const parentAfter = await context.conversationAgentSessionRepository.findOne({
        where: { id: parentSession.id },
      })
      expect(parentAfter?.activeAgentId).toBeNull()
    })

    it("keeps the parent's active agent set while required fields are still missing", async () => {
      const context = getTestContext()
      const { service, testAgentSettings, testOrganization, testProject, testUser } = context
      const connectScope = { organizationId: testOrganization.id, projectId: testProject.id }
      const { childAgent } = await buildChildAgentAndSettings(context)

      const parentSession = await service.createSession({
        connectScope,
        agentSettingsId: testAgentSettings.id,
        userId: testUser.id,
        type: "playground",
      })
      const childSession = await service.findOrCreateSubSession({
        connectScope,
        agentId: childAgent.id,
        userId: testUser.id,
        parentSessionId: parentSession.id,
        type: "playground",
      })
      await service.setActiveAgent({
        connectScope,
        sessionId: parentSession.id,
        activeAgentId: childAgent.id,
      })

      await service.updateSessionResult({
        connectScope,
        sessionId: childSession.id,
        input: { unrelatedField: "not the required one" },
      })

      const parentAfter = await context.conversationAgentSessionRepository.findOne({
        where: { id: parentSession.id },
      })
      expect(parentAfter?.activeAgentId).toBe(childAgent.id)
    })
  })
})
