import { afterAll } from "@jest/globals"
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
})
