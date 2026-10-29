import { AgentModel, type OAuthGrantablePermission } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { obtainTokens, resetRateLimits } from "@/domains/oauth/e2e-tests/oauth-test.helpers"
import type { OrganizationRoleKey } from "@/domains/organizations/memberships/organization-membership.types"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { listenOnLoopback, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import {
  AGENT_NOT_DUPLICABLE_ERROR,
  AGENT_NOT_FOUND_ERROR,
  PROJECT_NOT_FOUND_ERROR,
} from "../mcp-agent-tools.service"
import { McpEndpointModule } from "../mcp-endpoint.module"

type ProtocolEra = "2026-07-28" | "2025"

const ALL_PERMISSIONS: OAuthGrantablePermission[] = [
  "project.read",
  "agent.create",
  "agent.settings.draft.update",
]

describe("MCP endpoint", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let baseUrl: string
  let endpointUrl: URL
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [McpEndpointModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    configureGlobalPrefix(app)
    baseUrl = await listenOnLoopback(app)
    endpointUrl = new URL(`${baseUrl}/api/mcp`)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    resetRateLimits(app)
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (
    organizationRole: OrganizationRoleKey = "org_owner",
    projectRole: ProjectRoleKey = "project_owner",
  ) => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      organizationMembership: { roleKeys: [organizationRole] },
      projectMembership: { roleKeys: [projectRole] },
    })
    authSubject = user.authSubject!
    return { user, organization, project }
  }

  /** A grant through the real flow: registration, consent as the current user, code exchange. */
  const grantAccess = async (
    projectIds: string[],
    permissions: OAuthGrantablePermission[] = ALL_PERMISSIONS,
  ) => (await obtainTokens(baseUrl, { projectIds, permissions })).accessToken

  const connect = async (accessToken: string, era: ProtocolEra = "2026-07-28") => {
    const client = new Client(
      { name: "e2e-test-client", version: "1.0.0" },
      era === "2026-07-28" ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : {},
    )
    const transport = new StreamableHTTPClientTransport(endpointUrl, {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    await client.connect(transport)
    return client
  }

  const postToolsList = (accessToken?: string) => {
    const call = request(baseUrl)
      .post("/api/mcp")
      .set("Accept", "application/json, text/event-stream")
    if (accessToken) call.set("Authorization", `Bearer ${accessToken}`)
    return call.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })
  }

  describe("authentication", () => {
    it("answers 401 with a challenge naming the protected resource metadata", async () => {
      const response = await postToolsList()

      expect(response.status).toBe(401)
      expect(response.headers["www-authenticate"]).toBe(
        `Bearer resource_metadata="${endpointUrl.origin}/.well-known/oauth-protected-resource/api/mcp"`,
      )
    })

    it("names the API's authorization server in the protected resource metadata", async () => {
      const response = await request(baseUrl).get("/.well-known/oauth-protected-resource/api/mcp")

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        resource: endpointUrl.toString(),
        authorization_servers: [`${baseUrl}/api/oauth`],
        scopes_supported: ALL_PERMISSIONS,
      })
    })

    it("refuses a web app token", async () => {
      await createContext()

      const response = await postToolsList("token")

      expect(response.status).toBe(401)
      expect(response.headers["www-authenticate"]).toContain('error="invalid_token"')
    })

    it("stops at once when the person revokes the grant", async () => {
      const { project } = await createContext()
      const accessToken = await grantAccess([project.id])
      const [grant] = (
        await request(baseUrl).get("/api/oauth/grants").set("Authorization", "Bearer token")
      ).body.data

      await request(baseUrl)
        .delete(`/api/oauth/grants/${grant.id}`)
        .set("Authorization", "Bearer token")

      expect((await postToolsList(accessToken)).status).toBe(401)
    })
  })

  describe.each<ProtocolEra>(["2026-07-28", "2025"])("over protocol %s", (era) => {
    it("lists the tools", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id]), era)

      const { tools } = await client.listTools()

      expect(tools.map((tool) => tool.name).sort()).toEqual([
        "create_agent",
        "duplicate_agent",
        "list_agents",
        "list_projects",
        "update_agent",
      ])
      await client.close()
    })

    it("lists the granted projects", async () => {
      const { organization, project } = await createContext()
      const client = await connect(await grantAccess([project.id]), era)

      const result = await client.callTool({ name: "list_projects", arguments: {} })

      expect(result.structuredContent).toEqual({
        projects: [
          {
            id: project.id,
            name: project.name,
            organizationId: organization.id,
            organizationName: organization.name,
            canCreateAgents: true,
          },
        ],
      })
      await client.close()
    })

    it("creates and publishes an agent", async () => {
      const { organization, project, user } = await createContext()
      const client = await connect(await grantAccess([project.id]), era)

      const result = await client.callTool({
        name: "create_agent",
        arguments: {
          projectId: project.id,
          name: "Helpful Assistant",
          instructions: "Answer questions about the product.",
          model: AgentModel.Gemini35Flash,
        },
      })

      expect(result.isError).toBeFalsy()
      const { agent } = result.structuredContent as { agent: { id: string } }
      expect(agent).toMatchObject({
        name: "Helpful Assistant",
        type: "conversation",
        projectId: project.id,
        organizationId: organization.id,
      })
      const savedAgent = await setup.getRepository(Agent).findOneBy({ id: agent.id })
      expect(savedAgent?.name).toBe("Helpful Assistant")
      const agentSettings = await setup
        .getRepository(AgentSettings)
        .findOneBy({ agentId: agent.id, revision: 1 })
      expect(agentSettings).toMatchObject({
        instructions: "Answer questions about the product.",
        model: AgentModel.Gemini35Flash,
        isDraft: false,
      })
      await expectActivityCreated("agent.create", {
        userId: user.id,
        organizationId: organization.id,
        projectId: project.id,
      })
      await client.close()
    })
  })

  describe("update_agent", () => {
    const createTestAgent = async (client: Client, projectId: string) => {
      const result = await client.callTool({
        name: "create_agent",
        arguments: {
          projectId,
          name: "Helpful Assistant",
          instructions: "Answer questions about the product.",
          model: AgentModel.Gemini35FlashLite,
        },
      })
      return (result.structuredContent as { agent: { id: string } }).agent.id
    }

    it("lists the agents the person can change", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id]))
      const agentId = await createTestAgent(client, project.id)

      const result = await client.callTool({
        name: "list_agents",
        arguments: { projectId: project.id },
      })

      expect(result.structuredContent).toMatchObject({
        agents: [
          {
            id: agentId,
            name: "Helpful Assistant",
            model: AgentModel.Gemini35FlashLite,
            canUpdate: true,
          },
        ],
      })
      await client.close()
    })

    it("switches the model in a draft, leaving the published version", async () => {
      const { project, user } = await createContext()
      const client = await connect(await grantAccess([project.id]))
      const agentId = await createTestAgent(client, project.id)

      const result = await client.callTool({
        name: "update_agent",
        arguments: { agentId, model: AgentModel.Gemini38Flash },
      })

      expect(result.isError).toBeFalsy()
      expect(result.structuredContent).toMatchObject({
        agent: {
          id: agentId,
          model: AgentModel.Gemini38Flash,
          draftRevision: 2,
          published: true,
          canDuplicate: true,
        },
      })
      const revisions = await setup
        .getRepository(AgentSettings)
        .find({ where: { agentId }, order: { revision: "ASC" } })
      expect(
        revisions.map((revision) => [revision.revision, revision.isDraft, revision.model]),
      ).toEqual([
        [1, false, AgentModel.Gemini35FlashLite],
        [2, true, AgentModel.Gemini38Flash],
      ])
      await expectActivityCreated("agentSettings.update", {
        userId: user.id,
        projectId: project.id,
        entityId: agentId,
        entityType: "agent",
      })
      await client.close()
    })

    it("refuses without the agent.settings.draft.update grant", async () => {
      const { project } = await createContext()
      const client = await connect(
        await grantAccess([project.id], ["project.read", "agent.create"]),
      )
      const agentId = await createTestAgent(client, project.id)

      const listed = await client.callTool({
        name: "list_agents",
        arguments: { projectId: project.id },
      })
      const result = await client.callTool({
        name: "update_agent",
        arguments: { agentId, model: AgentModel.Gemini38Flash },
      })

      expect(listed.structuredContent).toMatchObject({
        agents: [{ id: agentId, canUpdate: false }],
      })
      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: "text", text: AGENT_NOT_FOUND_ERROR }])
      await client.close()
    })

    it("adds to an existing draft instead of starting another one", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id]))
      const agentId = await createTestAgent(client, project.id)

      await client.callTool({
        name: "update_agent",
        arguments: { agentId, model: AgentModel.Gemini38Flash },
      })
      await client.callTool({
        name: "update_agent",
        arguments: { agentId, instructions: "Answer briefly." },
      })

      const revisions = await setup
        .getRepository(AgentSettings)
        .find({ where: { agentId }, order: { revision: "ASC" } })
      expect(revisions).toHaveLength(2)
      expect(revisions[1]).toMatchObject({
        isDraft: true,
        model: AgentModel.Gemini38Flash,
        instructions: "Answer briefly.",
      })
      await client.close()
    })

    it("error when model is not available", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id]))
      const agentId = await createTestAgent(client, project.id)

      const result = await client.callTool({
        name: "update_agent",
        arguments: { agentId, model: AgentModel.Gemini25Flash },
      })

      expect(result.isError).toBe(true)
      expect(result.content).toEqual([
        { type: "text", text: `Model ${AgentModel.Gemini25Flash} is no longer available` },
      ])
      await client.close()
    })
  })

  describe("duplicate_agent", () => {
    const createTestAgent = async (client: Client, projectId: string) => {
      const result = await client.callTool({
        name: "create_agent",
        arguments: {
          projectId,
          name: "Helpful Assistant",
          instructions: "Answer questions about the product.",
          model: AgentModel.Gemini35FlashLite,
        },
      })
      return (result.structuredContent as { agent: { id: string } }).agent.id
    }

    it("copies an agent into a draft that nothing uses until it is published", async () => {
      const { organization, project, user } = await createContext()
      const client = await connect(await grantAccess([project.id]))
      const agentId = await createTestAgent(client, project.id)

      const result = await client.callTool({
        name: "duplicate_agent",
        arguments: { agentId, name: "Helpful Assistant (copy)" },
      })

      expect(result.isError).toBeFalsy()
      const { agent: copy } = result.structuredContent as { agent: { id: string } }
      expect(copy).toMatchObject({
        name: "Helpful Assistant (copy)",
        type: "conversation",
        model: AgentModel.Gemini35FlashLite,
        published: false,
        draftRevision: 1,
        canUpdate: true,
        canDuplicate: true,
      })
      expect(copy.id).not.toBe(agentId)
      const copyRevisions = await setup
        .getRepository(AgentSettings)
        .find({ where: { agentId: copy.id } })
      expect(
        copyRevisions.map((revision) => [
          revision.revision,
          revision.isDraft,
          revision.instructions,
        ]),
      ).toEqual([[1, true, "Answer questions about the product."]])
      await expectActivityCreated("agent.duplicate", {
        userId: user.id,
        organizationId: organization.id,
        projectId: project.id,
        entityId: agentId,
        entityType: "agent",
      })
      await client.close()
    })

    it("lists the copy as unpublished, next to the original", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id]))
      const agentId = await createTestAgent(client, project.id)
      const duplicated = await client.callTool({
        name: "duplicate_agent",
        arguments: { agentId, name: "Helpful Assistant (copy)" },
      })
      const copyId = (duplicated.structuredContent as { agent: { id: string } }).agent.id

      const result = await client.callTool({
        name: "list_agents",
        arguments: { projectId: project.id },
      })

      expect(result.isError).toBeFalsy()
      const { agents } = result.structuredContent as {
        agents: Array<{ id: string; published: boolean; canDuplicate: boolean }>
      }
      const publishedById = Object.fromEntries(agents.map((agent) => [agent.id, agent.published]))
      expect(publishedById).toEqual({ [agentId]: true, [copyId]: false })
      expect(agents.every((agent) => agent.canDuplicate)).toBe(true)
      await client.close()
    })

    it("refuses without the agent.create grant", async () => {
      const { project } = await createContext()
      const agentId = await createTestAgent(
        await connect(await grantAccess([project.id])),
        project.id,
      )
      const client = await connect(
        await grantAccess([project.id], ["project.read", "agent.settings.draft.update"]),
      )

      const listed = await client.callTool({
        name: "list_agents",
        arguments: { projectId: project.id },
      })
      const result = await client.callTool({
        name: "duplicate_agent",
        arguments: { agentId, name: "Helpful Assistant (copy)" },
      })

      expect(listed.structuredContent).toMatchObject({
        agents: [{ id: agentId, canDuplicate: false }],
      })
      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: "text", text: AGENT_NOT_DUPLICABLE_ERROR }])
      expect(await setup.getRepository(Agent).count()).toBe(1)
      await client.close()
    })

    it("refuses an agent of a project outside the grant", async () => {
      const { project, user } = await createContext()
      const agentId = await createTestAgent(
        await connect(await grantAccess([project.id])),
        project.id,
      )
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      await addUserToProject({
        repositories,
        project: otherProject,
        user,
        membership: { roleKeys: ["project_owner"] },
      })
      authSubject = user.authSubject!
      const client = await connect(await grantAccess([otherProject.id]))

      const result = await client.callTool({
        name: "duplicate_agent",
        arguments: { agentId, name: "Helpful Assistant (copy)" },
      })

      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: "text", text: AGENT_NOT_DUPLICABLE_ERROR }])
      await client.close()
    })

    it("explains why a name too short is refused", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id]))
      const agentId = await createTestAgent(client, project.id)

      const result = await client.callTool({
        name: "duplicate_agent",
        arguments: { agentId, name: "ab" },
      })

      expect(result.isError).toBe(true)
      // The input schema names the field and the minimum, whatever the SDK's wording.
      expect(result.content).toEqual([{ type: "text", text: expect.stringMatching(/name.*3/s) }])
      expect(await setup.getRepository(Agent).count()).toBe(1)
      await client.close()
    })

    it.each([
      {
        case: "a project owner who is only a member of the agent",
        project: "project_owner",
        agent: "agent_member",
      },
      {
        case: "an agent owner who cannot create agents in the project",
        project: "project_member",
        agent: "agent_owner",
      },
    ] as const)("refuses $case, even with the whole grant", async (roles) => {
      const { user, agent } = await createOrganizationWithAgent(repositories, {
        organizationMembership: { roleKeys: ["org_member"] },
        projectMembership: { roleKeys: [roles.project] },
        agentMembership: { roleKeys: [roles.agent] },
      })
      authSubject = user.authSubject!
      const client = await connect(await grantAccess([agent.projectId]))

      const listed = await client.callTool({
        name: "list_agents",
        arguments: { projectId: agent.projectId },
      })
      const result = await client.callTool({
        name: "duplicate_agent",
        arguments: { agentId: agent.id, name: "Helpful Assistant (copy)" },
      })

      expect(listed.structuredContent).toMatchObject({
        agents: [{ id: agent.id, canDuplicate: false }],
      })
      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: "text", text: AGENT_NOT_DUPLICABLE_ERROR }])
      expect(await setup.getRepository(Agent).count()).toBe(1)
      await client.close()
    })

    it.each([
      { case: "hides it from an agent member", agent: "agent_member", listed: false },
      { case: "shows it to its owner", agent: "agent_owner", listed: true },
    ] as const)("lists a never-published agent only to people who see its draft: $case", async (roles) => {
      const { user, agent } = await createOrganizationWithAgent(repositories, {
        organizationMembership: { roleKeys: ["org_member"] },
        projectMembership: { roleKeys: ["project_member"] },
        agentMembership: { roleKeys: [roles.agent] },
        agentSettings: { isDraft: true },
      })
      authSubject = user.authSubject!
      const client = await connect(await grantAccess([agent.projectId]))

      const result = await client.callTool({
        name: "list_agents",
        arguments: { projectId: agent.projectId },
      })

      expect(result.structuredContent).toEqual({
        agents: roles.listed ? [expect.objectContaining({ id: agent.id, published: false })] : [],
      })
      await client.close()
    })
  })

  describe("what the grant allows", () => {
    it("hides the projects outside the grant", async () => {
      const { project, user } = await createContext()
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      await addUserToProject({
        repositories,
        project: otherProject,
        user,
        membership: { roleKeys: ["project_owner"] },
      })
      authSubject = user.authSubject!
      const client = await connect(await grantAccess([project.id]))

      const result = await client.callTool({ name: "list_projects", arguments: {} })
      const creation = await client.callTool({
        name: "create_agent",
        arguments: { projectId: otherProject.id, name: "Helpful Assistant", instructions: "Help." },
      })

      expect(result.structuredContent).toMatchObject({ projects: [{ id: project.id }] })
      expect(creation.content).toEqual([{ type: "text", text: PROJECT_NOT_FOUND_ERROR }])
      await client.close()
    })

    it("does not create agents without the agent.create grant", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id], ["project.read"]))

      const projects = await client.callTool({ name: "list_projects", arguments: {} })
      const creation = await client.callTool({
        name: "create_agent",
        arguments: { projectId: project.id, name: "Helpful Assistant", instructions: "Help." },
      })

      expect(projects.structuredContent).toMatchObject({
        projects: [{ id: project.id, canCreateAgents: false }],
      })
      expect(creation.isError).toBe(true)
      expect(await setup.getRepository(Agent).count()).toBe(0)
      await client.close()
    })

    it("does not create agents for a project member, even with the grant", async () => {
      const { project } = await createContext("org_member", "project_member")
      const client = await connect(await grantAccess([project.id]))

      const result = await client.callTool({
        name: "create_agent",
        arguments: { projectId: project.id, name: "Helpful Assistant", instructions: "Help." },
      })

      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: "text", text: PROJECT_NOT_FOUND_ERROR }])
      expect(await setup.getRepository(Agent).count()).toBe(0)
      await client.close()
    })

    it("explains why an extraction agent without an output schema is refused", async () => {
      const { project } = await createContext()
      const client = await connect(await grantAccess([project.id]))

      const result = await client.callTool({
        name: "create_agent",
        arguments: {
          projectId: project.id,
          name: "Summary Extractor",
          type: "extraction",
          instructions: "Extract a title and a summary.",
        },
      })

      expect(result.isError).toBe(true)
      expect(result.content).toEqual([
        {
          type: "text",
          text: "outputJsonSchema: outputJsonSchema is required when type is not 'conversation'",
        },
      ])
      await client.close()
    })
  })
})
