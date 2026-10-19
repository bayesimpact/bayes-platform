import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { ActiveAgentScopeService } from "./active-agent-scope.service"

describe("ActiveAgentScopeService", () => {
  const organization = organizationFactory.build()
  const project = projectFactory.transient({ organization }).build()
  const connectScope = { organizationId: organization.id, projectId: project.id }
  const rootAgent = agentFactory
    .transient({ organization, project })
    .build({ name: "Orchestrator", type: "conversation" })
  const rootAgentSettings = agentSettingsFactory
    .transient({ organization, project, agent: rootAgent })
    .build({ revision: 1 })
  const activeAgent = agentFactory
    .transient({ organization, project })
    .build({ name: "Helpful Assistant", type: "conversation" })

  const buildService = (publishedSettings: unknown) =>
    new ActiveAgentScopeService(
      { findAgentById: jest.fn().mockResolvedValue(activeAgent) } as never,
      { findLastPublished: jest.fn().mockResolvedValue(publishedSettings) } as never,
    )

  const resolve = (service: ActiveAgentScopeService) =>
    service.resolve({ connectScope, rootAgent, rootAgentSettings, activeAgentId: activeAgent.id })

  it("hands the turn to the active sub-agent with its published settings", async () => {
    const publishedSettings = agentSettingsFactory
      .transient({ organization, project, agent: activeAgent })
      .build({ revision: 3 })

    const turnAgent = await resolve(buildService(publishedSettings))

    expect(turnAgent).toEqual({
      agent: activeAgent,
      agentSettings: publishedSettings,
      handoff: { parentAgent: rootAgent },
    })
  })

  it("lets the session's agent answer when the active sub-agent was never published", async () => {
    const turnAgent = await resolve(buildService(undefined))

    expect(turnAgent).toEqual({ agent: rootAgent, agentSettings: rootAgentSettings })
  })
})
