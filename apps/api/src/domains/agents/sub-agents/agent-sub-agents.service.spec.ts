import { afterAll } from "@jest/globals"
import { UnprocessableEntityException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentsModule } from "../agents.module"
import { AgentSubAgentsService } from "./agent-sub-agents.service"

describe("AgentSubAgentsService", () => {
  let service: AgentSubAgentsService
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
    service = setup.module.get<AgentSubAgentsService>(AgentSubAgentsService)
    repositories = setup.getAllRepositories()
  })

  it("replaces and lists sub-agents for a conversation agent", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const childAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        name: "Resource Lookup",
        type: "conversation",
      }),
    )

    const result = await service.replaceSubAgents({
      connectScope: { organizationId: organization.id, projectId: project.id },
      parentAgent: agent,
      subAgents: [
        {
          childAgentId: childAgent.id,
          toolName: "ask_resources",
          description: "Use for resource questions.",
          enabled: true,
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      parentAgentId: agent.id,
      childAgentId: childAgent.id,
      toolName: "ask_resources",
      description: "Use for resource questions.",
      enabled: true,
    })
    expect(result[0]?.childAgent.name).toBe("Resource Lookup")

    const listed = await service.listSubAgents({
      connectScope: { organizationId: organization.id, projectId: project.id },
      parentAgent: agent,
    })
    expect(listed.map((row) => row.childAgentId)).toEqual([childAgent.id])
  })

  it("removes rows missing from the replacement set", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const firstChild = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "First Child" }),
    )
    const secondChild = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Second Child" }),
    )

    const connectScope = { organizationId: organization.id, projectId: project.id }
    await service.replaceSubAgents({
      connectScope,
      parentAgent: agent,
      subAgents: [
        {
          childAgentId: firstChild.id,
          toolName: "ask_first",
          description: "",
          enabled: true,
        },
      ],
    })
    await service.replaceSubAgents({
      connectScope,
      parentAgent: agent,
      subAgents: [
        {
          childAgentId: secondChild.id,
          toolName: "ask_second",
          description: "",
          enabled: false,
        },
      ],
    })

    const rows = await repositories.agentSubAgentRepository.find({
      where: { parentAgentId: agent.id },
    })
    expect(rows.map((row) => row.childAgentId)).toEqual([secondChild.id])
    expect(rows[0]?.enabled).toBe(false)
  })

  it("rejects self-reference, duplicate child agents, and duplicate tool names", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const childAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    const connectScope = { organizationId: organization.id, projectId: project.id }

    await expect(
      service.replaceSubAgents({
        connectScope,
        parentAgent: agent,
        subAgents: [
          {
            childAgentId: agent.id,
            toolName: "ask_self",
            description: "",
            enabled: true,
          },
        ],
      }),
    ).rejects.toThrow(UnprocessableEntityException)

    await expect(
      service.replaceSubAgents({
        connectScope,
        parentAgent: agent,
        subAgents: [
          {
            childAgentId: childAgent.id,
            toolName: "ask_child",
            description: "",
            enabled: true,
          },
          {
            childAgentId: childAgent.id,
            toolName: "ask_child_again",
            description: "",
            enabled: true,
          },
        ],
      }),
    ).rejects.toThrow("Duplicate sub-agents are not allowed")

    const otherChildAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    await expect(
      service.replaceSubAgents({
        connectScope,
        parentAgent: agent,
        subAgents: [
          {
            childAgentId: childAgent.id,
            toolName: "ask_duplicate",
            description: "",
            enabled: true,
          },
          {
            childAgentId: otherChildAgent.id,
            toolName: "ask_duplicate",
            description: "",
            enabled: true,
          },
        ],
      }),
    ).rejects.toThrow("Duplicate sub-agent tool names are not allowed")
  })

  it("rejects sub-agents outside the project", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const otherProjectAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project: otherProject }).build(),
    )
    const connectScope = { organizationId: organization.id, projectId: project.id }

    await expect(
      service.replaceSubAgents({
        connectScope,
        parentAgent: agent,
        subAgents: [
          {
            childAgentId: otherProjectAgent.id,
            toolName: "ask_other_project",
            description: "",
            enabled: true,
          },
        ],
      }),
    ).rejects.toThrow("One or more sub-agents do not exist in this project")
  })

  it("accepts non-conversation agents as sub-agents", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const extractionAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        type: "extraction",
      }),
    )
    const _extractionAgentSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent: extractionAgent }).build({
        outputJsonSchema: { type: "object", properties: {} },
      }),
    )
    const connectScope = { organizationId: organization.id, projectId: project.id }

    const result = await service.replaceSubAgents({
      connectScope,
      parentAgent: agent,
      subAgents: [
        {
          childAgentId: extractionAgent.id,
          toolName: "ask_extraction",
          description: "",
          enabled: true,
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.childAgentId).toBe(extractionAgent.id)
  })

  it("rejects non-conversation parent agents", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
      agent: {
        type: "form",
      },
      agentSettings: {
        outputJsonSchema: { type: "object", properties: {} },
      },
    })
    const childAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ type: "conversation" }),
    )
    const _childAgentSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent: childAgent }).build(),
    )

    await expect(
      service.replaceSubAgents({
        connectScope: { organizationId: organization.id, projectId: project.id },
        parentAgent: agent,
        subAgents: [
          {
            childAgentId: childAgent.id,
            toolName: "ask_child",
            description: "",
            enabled: true,
          },
        ],
      }),
    ).rejects.toThrow("Only conversation agents can have sub-agents")
  })

  it("returns an empty list for non-conversation parent agents instead of throwing", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
      agent: {
        type: "form",
      },
      agentSettings: {
        outputJsonSchema: { type: "object", properties: {} },
      },
    })

    const listed = await service.listSubAgents({
      connectScope: { organizationId: organization.id, projectId: project.id },
      parentAgent: agent,
    })

    expect(listed).toEqual([])
  })
})
