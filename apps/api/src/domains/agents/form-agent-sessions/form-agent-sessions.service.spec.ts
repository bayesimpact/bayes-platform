import { afterAll } from "@jest/globals"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentsModule } from "../agents.module"
import { FormAgentSessionsService } from "./form-agent-sessions.service"

const PARENT_SESSION_ID = "11111111-1111-1111-1111-111111111111"

describe("FormAgentSessionsService", () => {
  let service: FormAgentSessionsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
    })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<FormAgentSessionsService>(FormAgentSessionsService)
    repositories = setup.getAllRepositories()
  })

  const createFormAgent = async () => {
    const { organization, project, user } = await createOrganizationWithAgent(repositories)
    const formAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        name: "Intake Form",
        type: "form",
        outputJsonSchema: { type: "object", properties: {} },
      }),
    )
    return {
      connectScope: { organizationId: organization.id, projectId: project.id },
      formAgent,
      user,
    }
  }

  describe("findOrCreateSubSession", () => {
    it("creates a form sub-session marked as a sub-session and linked to the parent", async () => {
      const { connectScope, formAgent, user } = await createFormAgent()

      const session = await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })

      expect(session.isSubSession).toBe(true)
      expect(session.parentSessionId).toBe(PARENT_SESSION_ID)
      expect(session.agentId).toBe(formAgent.id)
      expect(session.userId).toBe(user.id)
      expect(session.type).toBe("playground")
    })

    it("reuses the existing sub-session for the same parent session and form agent", async () => {
      const { connectScope, formAgent, user } = await createFormAgent()

      const first = await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })
      const second = await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })

      expect(second.id).toBe(first.id)
      const sessions = await repositories.formAgentSessionRepository.find({
        where: { parentSessionId: PARENT_SESSION_ID },
      })
      expect(sessions).toHaveLength(1)
    })

    it("keeps the accumulated form state when reusing the sub-session", async () => {
      const { connectScope, formAgent, user } = await createFormAgent()

      const created = await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })
      await service.updateSessionResult({
        connectScope,
        sessionId: created.id,
        input: { name: "Alex" },
      })

      const reused = await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })

      expect(reused.id).toBe(created.id)
      expect(reused.result).toEqual({ name: "Alex" })
    })

    it("excludes sub-sessions from the user-facing session list", async () => {
      const { connectScope, formAgent, user } = await createFormAgent()

      const userSession = await service.createSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        type: "playground",
      })
      await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })

      const listed = await service.listSessions({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        type: "playground",
      })

      expect(listed.map((session) => session.id)).toEqual([userSession.id])
    })
  })

  describe("listSubSessions", () => {
    it("returns only the sub-sessions for the given parent session, user and type", async () => {
      const { connectScope, formAgent, user } = await createFormAgent()

      const subSession = await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })
      // A sub-session under a different parent session must be excluded.
      await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: "22222222-2222-2222-2222-222222222222",
        type: "playground",
      })

      const listed = await service.listSubSessions({
        connectScope,
        parentSessionId: PARENT_SESSION_ID,
        userId: user.id,
        type: "playground",
      })

      expect(listed.map((session) => session.id)).toEqual([subSession.id])
    })

    it("does not return another user's sub-sessions", async () => {
      const { connectScope, formAgent, user } = await createFormAgent()

      await service.findOrCreateSubSession({
        connectScope,
        agentId: formAgent.id,
        userId: user.id,
        parentSessionId: PARENT_SESSION_ID,
        type: "playground",
      })

      const listed = await service.listSubSessions({
        connectScope,
        parentSessionId: PARENT_SESSION_ID,
        userId: "99999999-9999-9999-9999-999999999999",
        type: "playground",
      })

      expect(listed).toHaveLength(0)
    })
  })
})
