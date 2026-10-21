import {
  AgentLocale,
  AgentMemoryMode,
  AgentModel,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import { agentMcpServerFactory } from "@/domains/mcp-servers/agent-mcp-server.factory"
import { mcpServerFactory } from "@/domains/mcp-servers/mcp-server.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { agentEmbedConfigFactory } from "@/domains/public-chat/agent-embed-configs/agent-embed-config.factory"
import { userFactory } from "@/domains/users/user.factory"
import { agentFactory } from "./agent.factory"
import { AgentDuplicationService } from "./agent-duplication.service"
import { AgentsModule } from "./agents.module"
import { conversationAgentSessionFactory } from "./conversation-agent-sessions/conversation-agent-session.factory"
import { addUserToAgent } from "./memberships/agent-membership.factory"
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
import { agentMemoryFactory } from "./memories/agent-memory.factory"
import { agentSettingsFactory } from "./settings/agent.settings.factory"
import { agentSubAgentFactory } from "./sub-agents/agent-sub-agent.factory"

describe("AgentDuplicationService", () => {
  let service: AgentDuplicationService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [AgentsModule] })
    service = setup.module.get<AgentDuplicationService>(AgentDuplicationService)
    repositories = setup.getAllRepositories()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const sourceModelOptions = {
    temperature: 0.4,
    providerOptions: {
      vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
    },
  }

  /** An agent with something in every table a copy reads, and some that it must leave alone. */
  const createSourceAgent = async () => {
    const context = await createOrganizationWithAgent(repositories, {
      agentSettings: { revision: 1, instructions: "First version." },
    })
    const { organization, project, user, agent } = context
    const scope = { organization, project }

    const publishedSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ ...scope, agent }).build({
        revision: 2,
        revisionName: "Second",
        instructions: "Answer questions about the product.",
        model: AgentModel.Gemini35Flash,
        providerOptions: sourceModelOptions,
        locale: AgentLocale.FR,
        documentsRagMode: DocumentsRagMode.Tags,
        greetingMessage: "Hello!",
        outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
        fillFormEnabled: true,
        priorityCallsEnabled: true,
        memoryMode: AgentMemoryMode.Ask,
      }),
    )
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ ...scope, agent })
        .build({ revision: 3, instructions: "Work in progress." }),
    )

    const documentTags = await setup
      .getRepository(DocumentTag)
      .save([
        documentTagFactory.transient(scope).build({ name: "Product" }),
        documentTagFactory.transient(scope).build({ name: "Pricing" }),
      ])
    agent.documentTags = documentTags
    await repositories.agentRepository.save(agent)

    const projectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Billing",
      }),
    )
    await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({
        agentId: agent.id,
        projectAgentSessionCategoryId: projectCategory.id,
        name: projectCategory.name,
      }),
    )
    const removedCategory = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({
        agentId: agent.id,
        projectAgentSessionCategoryId: null,
        name: "Support",
      }),
    )
    await repositories.agentSessionCategoryRepository.softDelete(removedCategory.id)
    // Still active on the original, but the project removed it: a new agent could not get it.
    const removedProjectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Legacy",
      }),
    )
    await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({
        agentId: agent.id,
        projectAgentSessionCategoryId: removedProjectCategory.id,
        name: removedProjectCategory.name,
      }),
    )
    await repositories.projectAgentSessionCategoryRepository.softDelete(removedProjectCategory.id)

    const [mcpServer, disabledMcpServer, deletedMcpServer] =
      await repositories.mcpServerRepository.save([
        mcpServerFactory.build({ projectId: project.id }),
        mcpServerFactory.build({ projectId: project.id }),
        mcpServerFactory.build({ projectId: project.id }),
      ])
    if (!mcpServer || !disabledMcpServer || !deletedMcpServer) {
      throw new Error("MCP servers not saved")
    }
    await repositories.agentMcpServerRepository.save([
      agentMcpServerFactory.transient({ agent, mcpServer }).build(),
      agentMcpServerFactory
        .transient({ agent, mcpServer: disabledMcpServer })
        .build({ enabled: false }),
      agentMcpServerFactory.transient({ agent, mcpServer: deletedMcpServer }).build(),
    ])
    await repositories.mcpServerRepository.softDelete(deletedMcpServer.id)

    const [childAgent, deletedChildAgent] = await repositories.agentRepository.save([
      agentFactory.transient(scope).build({ name: "Summary Bot" }),
      agentFactory.transient(scope).build({ name: "Triage Assistant" }),
    ])
    if (!childAgent || !deletedChildAgent) throw new Error("child agents not saved")
    await repositories.agentSubAgentRepository.save([
      agentSubAgentFactory
        .handoff()
        .tool({ toolName: "hand_over_to_summary", description: "Summaries go there." })
        .transient({ ...scope, parentAgent: agent, childAgent })
        .build({ enabled: false }),
      agentSubAgentFactory
        .transient({ ...scope, parentAgent: agent, childAgent: deletedChildAgent })
        .build(),
    ])
    await repositories.agentRepository.softDelete(deletedChildAgent.id)

    await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ ...scope, agent, user })
        .live()
        .build(),
    )
    await repositories.agentMemoryRepository.save(
      agentMemoryFactory.transient({ ...scope, agent, user }).build(),
    )
    await repositories.agentEmbedConfigRepository.save(
      agentEmbedConfigFactory.transient({ ...scope, agent }).build(),
    )

    return {
      ...context,
      publishedSettings,
      documentTags,
      projectCategory,
      mcpServer,
      disabledMcpServer,
      childAgent,
    }
  }

  const duplicate = (
    source: Awaited<ReturnType<typeof createOrganizationWithProject>> & { agent: { id: string } },
    name = "Helpful Assistant (copy)",
  ) =>
    service.duplicateAgent({
      connectScope: { organizationId: source.organization.id, projectId: source.project.id },
      agentId: source.agent.id,
      name,
      userId: source.user.id,
    })

  it("copies the published settings into a draft revision 1 of a new agent", async () => {
    const source = await createSourceAgent()

    const { agent, agentSettings } = await duplicate(source)

    expect(agent.id).not.toBe(source.agent.id)
    expect(agent).toMatchObject({
      name: "Helpful Assistant (copy)",
      type: source.agent.type,
      organizationId: source.organization.id,
      projectId: source.project.id,
    })
    const revisions = await repositories.agentSettingsRepository.find({
      where: { agentId: agent.id },
    })
    expect(revisions).toHaveLength(1)
    expect(revisions[0]?.id).toBe(agentSettings.id)
    expect(agentSettings).toMatchObject({ revision: 1, isDraft: true, isArchived: false })
    expect(agentSettings.revisionName ?? null).toBeNull()
    // The whole row but what identifies it and its revision, so a settings column added later
    // is compared too.
    const rowColumns = new Set([
      ...["id", "createdAt", "updatedAt", "deletedAt", "organizationId", "projectId"],
      ...["agentId", "agent", "revision", "revisionName", "revisionDesc", "isDraft", "isArchived"],
    ])
    const settingsOf = (row: object) =>
      Object.fromEntries(Object.entries(row).filter(([column]) => !rowColumns.has(column)))
    const sourceRow = await repositories.agentSettingsRepository.findOneByOrFail({
      id: source.publishedSettings.id,
    })
    expect(settingsOf(revisions[0] ?? {})).toEqual(settingsOf(sourceRow))
    expect(settingsOf(sourceRow)).toMatchObject({
      instructions: "Answer questions about the product.",
      memoryMode: AgentMemoryMode.Ask,
      providerOptions: sourceModelOptions,
    })
  })

  it("copies the sources, categories, MCP servers and sub-agents that still exist", async () => {
    const source = await createSourceAgent()

    const { agent } = await duplicate(source)

    const copy = await repositories.agentRepository.findOne({
      where: { id: agent.id },
      relations: { documentTags: true, resourceLibraries: true },
    })
    expect(copy?.documentTags.map((documentTag) => documentTag.id).sort()).toEqual(
      source.documentTags.map((documentTag) => documentTag.id).sort(),
    )
    expect(copy?.resourceLibraries.map((resourceLibrary) => resourceLibrary.id)).toEqual(
      source.agentResourceLibraries.map((resourceLibrary) => resourceLibrary.id),
    )

    const categories = await repositories.agentSessionCategoryRepository.find({
      where: { agentId: agent.id },
    })
    expect(
      categories.map((category) => [category.projectAgentSessionCategoryId, category.name]),
    ).toEqual([[source.projectCategory.id, "Billing"]])

    const agentMcpServers = await repositories.agentMcpServerRepository.find({
      where: { agentId: agent.id },
    })
    expect(
      Object.fromEntries(
        agentMcpServers.map((agentMcpServer) => [
          agentMcpServer.mcpServerId,
          agentMcpServer.enabled,
        ]),
      ),
    ).toEqual({ [source.mcpServer.id]: true, [source.disabledMcpServer.id]: false })

    const subAgents = await repositories.agentSubAgentRepository.find({
      where: { parentAgentId: agent.id },
    })
    expect(subAgents).toHaveLength(1)
    expect(subAgents[0]).toMatchObject({
      childAgentId: source.childAgent.id,
      toolName: "hand_over_to_summary",
      description: "Summaries go there.",
      enabled: false,
      mode: "handoff",
    })
  })

  it("leaves the sessions, memories, embed settings and members with the original", async () => {
    const source = await createSourceAgent()
    const { user: agentMember } = await addUserToAgent({
      repositories,
      agent: source.agent,
      membership: { role: "member" },
    })

    const { agent } = await duplicate(source)

    expect(
      await repositories.conversationAgentSessionRepository.count({ where: { agentId: agent.id } }),
    ).toBe(0)
    expect(await repositories.agentMemoryRepository.count({ where: { agentId: agent.id } })).toBe(0)
    expect(
      await repositories.agentEmbedConfigRepository.count({ where: { agentId: agent.id } }),
    ).toBe(0)
    const memberships = await repositories.userMembershipRepository.find({
      where: { resourceType: "agent", resourceId: agent.id },
    })
    expect(memberships.map((membership) => membership.userId)).toEqual([source.user.id])
    expect(memberships.map((membership) => membership.userId)).not.toContain(agentMember.id)
  })

  it("makes the person who copies the owner, and the project admins admins of the copy", async () => {
    const source = await createSourceAgent()
    const projectAdmin = await repositories.userRepository.save(userFactory.build())
    await addUserToProject({
      repositories,
      project: source.project,
      user: projectAdmin,
      membership: { role: "admin" },
    })

    const { agent } = await duplicate(source)

    const memberships = await repositories.userMembershipRepository.find({
      where: { resourceType: "agent", resourceId: agent.id },
    })
    const roleByUserId = Object.fromEntries(
      memberships.map((membership) => [membership.userId, membership.role]),
    )
    expect(roleByUserId).toEqual({
      [source.user.id]: "owner",
      [projectAdmin.id]: "admin",
    })
  })

  it("leaves the original agent as it was", async () => {
    const source = await createSourceAgent()

    await duplicate(source)

    const revisions = await repositories.agentSettingsRepository.find({
      where: { agentId: source.agent.id },
      order: { revision: "ASC" },
    })
    expect(revisions.map((revision) => [revision.revision, revision.isDraft])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ])
    expect(
      await repositories.agentSubAgentRepository.count({
        where: { parentAgentId: source.agent.id },
      }),
    ).toBe(2)
  })

  it("leaves nothing behind when the last step fails", async () => {
    const source = await createSourceAgent()
    const countRows = async () => ({
      agents: await repositories.agentRepository.count(),
      agentSettings: await repositories.agentSettingsRepository.count(),
      categories: await repositories.agentSessionCategoryRepository.count(),
      mcpServers: await repositories.agentMcpServerRepository.count(),
      subAgents: await repositories.agentSubAgentRepository.count(),
      memberships: await repositories.userMembershipRepository.count({
        where: { resourceType: "agent" },
      }),
    })
    const before = await countRows()
    const failingStep = jest
      .spyOn(
        setup.module.get(AgentMembershipsService),
        "createAdminAgentMembershipsForProjectAdmins",
      )
      .mockRejectedValueOnce(new Error("Membership failure"))

    await expect(duplicate(source)).rejects.toThrow("Membership failure")

    expect(await countRows()).toEqual(before)
    failingStep.mockRestore()
  })

  it("copies the draft of an agent that was never published", async () => {
    const source = await createOrganizationWithAgent(repositories, {
      agentSettings: { isDraft: true, instructions: "Only a draft." },
    })

    const { agentSettings } = await duplicate(source)

    expect(agentSettings).toMatchObject({
      revision: 1,
      isDraft: true,
      instructions: "Only a draft.",
    })
  })

  it("trims the name and refuses one under 3 characters", async () => {
    const source = await createOrganizationWithAgent(repositories)

    const { agent } = await duplicate(source, "  Helpful Assistant v2  ")
    expect(agent.name).toBe("Helpful Assistant v2")

    await expect(duplicate(source, " ab ")).rejects.toThrow(UnprocessableEntityException)
  })

  it("does not find an agent of another project", async () => {
    const source = await createOrganizationWithAgent(repositories)
    const other = await createOrganizationWithProject(repositories)

    await expect(
      service.duplicateAgent({
        connectScope: { organizationId: other.organization.id, projectId: other.project.id },
        agentId: source.agent.id,
        name: "Helpful Assistant (copy)",
        userId: other.user.id,
      }),
    ).rejects.toThrow(NotFoundException)
    expect(await repositories.agentRepository.count()).toBe(1)
  })
})
