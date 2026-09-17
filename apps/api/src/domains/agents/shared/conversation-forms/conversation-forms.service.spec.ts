import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { ConversationFormsModule } from "./conversation-forms.module"
import { ConversationFormsService } from "./conversation-forms.service"

describe("ConversationFormsService", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let service: ConversationFormsService

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [ConversationFormsModule] })
    repositories = setup.getAllRepositories()
    service = setup.module.get(ConversationFormsService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const createSession = async () => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" }, agentSettings: { fillFormEnabled: true } },
    )
    const session = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory.transient({ organization, project, agent, user }).build(),
    )
    return {
      connectScope: { organizationId: organization.id, projectId: project.id },
      organization,
      project,
      agent,
      agentSettings,
      session,
    }
  }

  it("creates the form on the first write and merges the next ones field by field", async () => {
    const { connectScope, agent, agentSettings, session } = await createSession()
    const key = { connectScope, sessionId: session.id, agentId: agent.id }

    const first = await service.mergeFields({
      ...key,
      agentSettingsId: agentSettings.id,
      fields: { title: "Draft title" },
    })
    expect(first.state).toEqual({ title: "Draft title" })
    expect(first.status).toBe("in_progress")

    const second = await service.mergeFields({
      ...key,
      agentSettingsId: agentSettings.id,
      fields: { summary: "A short summary" },
    })
    expect(second.id).toBe(first.id)
    expect(second.state).toEqual({ title: "Draft title", summary: "A short summary" })

    const third = await service.mergeFields({
      ...key,
      agentSettingsId: agentSettings.id,
      fields: { title: "Final title" },
    })
    expect(third.state).toEqual({ title: "Final title", summary: "A short summary" })

    expect(
      await repositories.conversationFormRepository.findBy({ sessionId: session.id }),
    ).toHaveLength(1)
  })

  it("records the settings revision of the last write", async () => {
    const { connectScope, organization, project, agent, agentSettings, session } =
      await createSession()
    const key = { connectScope, sessionId: session.id, agentId: agent.id }
    await service.mergeFields({ ...key, agentSettingsId: agentSettings.id, fields: { a: 1 } })

    const nextRevision = await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: agentSettings.revision + 1 }),
    )
    const form = await service.mergeFields({
      ...key,
      agentSettingsId: nextRevision.id,
      fields: { b: 2 },
    })
    expect(form.agentSettingsId).toBe(nextRevision.id)
    expect(form.state).toEqual({ a: 1, b: 2 })
  })

  it("keeps one form per agent in the same session", async () => {
    const { connectScope, organization, project, agent, agentSettings, session } =
      await createSession()
    const otherAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ type: "conversation" }),
    )
    const otherSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent: otherAgent }).build(),
    )

    await service.mergeFields({
      connectScope,
      sessionId: session.id,
      agentId: agent.id,
      agentSettingsId: agentSettings.id,
      fields: { title: "Parent" },
    })
    await service.mergeFields({
      connectScope,
      sessionId: session.id,
      agentId: otherAgent.id,
      agentSettingsId: otherSettings.id,
      fields: { age: 42 },
    })

    const forms = await service.listForSession({ connectScope, sessionId: session.id })
    expect(forms.map((form) => [form.agentId, form.state])).toEqual([
      [agent.id, { title: "Parent" }],
      [otherAgent.id, { age: 42 }],
    ])

    const grouped = await service.listForSessions({ connectScope, sessionIds: [session.id] })
    expect(grouped.get(session.id)).toHaveLength(2)
    expect(await service.listForSessions({ connectScope, sessionIds: [] })).toEqual(new Map())
  })

  it("returns null for a session where the agent wrote nothing", async () => {
    const { connectScope, agent, session } = await createSession()
    expect(
      await service.findOne({ connectScope, sessionId: session.id, agentId: agent.id }),
    ).toBeNull()
  })

  it("does not read forms from another project", async () => {
    const { connectScope, agent, agentSettings, session } = await createSession()
    await service.mergeFields({
      connectScope,
      sessionId: session.id,
      agentId: agent.id,
      agentSettingsId: agentSettings.id,
      fields: { title: "Mine" },
    })
    const { connectScope: otherScope } = await createSession()

    expect(
      await service.findOne({ connectScope: otherScope, sessionId: session.id, agentId: agent.id }),
    ).toBeNull()
  })

  it("marks the form of an agent as concluded, leaving the others in progress", async () => {
    const { connectScope, agent, agentSettings, session } = await createSession()
    await service.mergeFields({
      connectScope,
      sessionId: session.id,
      agentId: agent.id,
      agentSettingsId: agentSettings.id,
      fields: { title: "Done" },
    })

    await service.conclude({ connectScope, sessionId: session.id, agentId: agent.id })

    const form = await service.findOne({ connectScope, sessionId: session.id, agentId: agent.id })
    expect(form?.status).toBe("concluded")
    expect(form?.state).toEqual({ title: "Done" })
    // Concluding an agent that wrote nothing is a no-op.
    await service.conclude({
      connectScope,
      sessionId: session.id,
      agentId: "00000000-0000-0000-0000-000000000000",
    })
  })
})
