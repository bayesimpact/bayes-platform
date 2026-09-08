import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { PDF_EXPORT_BUILT_IN_NAME, PDF_EXPORT_PRESET_SLUG } from "./built-in/built-in-mcp-servers"
import { McpServersModule } from "./mcp-servers.module"
import { McpServersService } from "./mcp-servers.service"

// An operator-seeded preset (seed-mcp-preset.ts): a preset slug and no
// project, but not on the built-in allowlist.
const OTHER_PRESET_SLUG = "other-preset"

describe("McpServersService", () => {
  let service: McpServersService
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let initialConverterAuth: string | undefined

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [McpServersModule],
    })
    await clearTestDatabase(setup.dataSource)
    repositories = setup.getAllRepositories()
    service = setup.module.get<McpServersService>(McpServersService)
    initialConverterAuth = process.env.PDF_CONVERTER_AUTH
  })

  afterAll(async () => {
    if (initialConverterAuth === undefined) {
      delete process.env.PDF_CONVERTER_AUTH
    } else {
      process.env.PDF_CONVERTER_AUTH = initialConverterAuth
    }
    await teardownTestDatabase(setup)
  })

  beforeEach(() => {
    delete process.env.PDF_CONVERTER_AUTH
  })

  afterEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const createAgent = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    return agent
  }

  describe("getAuthStatus", () => {
    const oauth = {
      clientId: "client-123",
      authorizationEndpoint: "https://auth.example.com/oauth2/authorize",
      tokenEndpoint: "https://auth.example.com/oauth2/token",
      resource: "https://mcp.example.com",
    }
    const url = "https://mcp.example.com/mcp"

    it("reports a fresh access token as connected", () => {
      const tokens = { accessToken: "at-1", expiresAt: Date.now() + 3600_000 }
      expect(service.getAuthStatus({ url, oauth: { ...oauth, tokens } })).toBe("oauthConnected")
    })

    it("reports an access token without a known expiry as connected", () => {
      const tokens = { accessToken: "at-1" }
      expect(service.getAuthStatus({ url, oauth: { ...oauth, tokens } })).toBe("oauthConnected")
    })

    it("reports an expired access token with a refresh token as connected", () => {
      const tokens = { accessToken: "at-1", refreshToken: "rt-1", expiresAt: Date.now() - 1000 }
      expect(service.getAuthStatus({ url, oauth: { ...oauth, tokens } })).toBe("oauthConnected")
    })

    it("reports an expired access token without a refresh token as pending", () => {
      const tokens = { accessToken: "at-1", expiresAt: Date.now() - 1000 }
      expect(service.getAuthStatus({ url, oauth: { ...oauth, tokens } })).toBe("oauthPending")
    })

    it("reports a server awaiting its first authorization as pending", () => {
      expect(service.getAuthStatus({ url, authMethod: "oauth" })).toBe("oauthPending")
      expect(service.getAuthStatus({ url, oauth })).toBe("oauthPending")
    })

    it("reports api key and unauthenticated servers", () => {
      expect(service.getAuthStatus({ url, apiKey: "sk" })).toBe("apiKey")
      expect(service.getAuthStatus({ url })).toBe("none")
    })
  })

  describe("createPreset", () => {
    it("should create a preset MCP server with encrypted config", async () => {
      const server = await service.createPreset("create-test", "Test Server", {
        url: "https://example.com/mcp",
        apiKey: "sk-test-key",
      })

      expect(server.id).toBeDefined()
      expect(server.name).toBe("Test Server")
      expect(server.presetSlug).toBe("create-test")
      expect(server.projectId).toBeNull()
      expect(server.encryptedConfig).not.toContain("sk-test-key")

      const saved = await repositories.mcpServerRepository.findOne({
        where: { id: server.id },
      })
      expect(saved).not.toBeNull()
      expect(saved?.encryptedConfig).not.toContain("sk-test-key")
    })
  })

  describe("createMcpServer", () => {
    it("should create a project-scoped server with encrypted config", async () => {
      const { project } = await createOrganizationWithProject(repositories)

      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Project Server",
        config: { url: "https://example.com/mcp", apiKey: "sk-project-key" },
      })

      expect(server.id).toBeDefined()
      expect(server.name).toBe("Project Server")
      expect(server.presetSlug).toBeNull()
      expect(server.projectId).toBe(project.id)
      expect(server.encryptedConfig).not.toContain("sk-project-key")
      expect(server.encryptedConfig).not.toContain("example.com")

      const saved = await repositories.mcpServerRepository.findOne({ where: { id: server.id } })
      expect(saved?.projectId).toBe(project.id)
      expect(saved?.encryptedConfig).toBe(server.encryptedConfig)
    })
  })

  describe("listMcpServers", () => {
    it("should return the project's servers sorted by name", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      await service.createMcpServer({
        projectId: project.id,
        name: "Zeta",
        config: { url: "https://zeta.example.com" },
      })
      await service.createMcpServer({
        projectId: project.id,
        name: "Alpha",
        config: { url: "https://alpha.example.com" },
      })
      await service.createMcpServer({
        projectId: project.id,
        name: "Mid",
        config: { url: "https://mid.example.com" },
      })

      const servers = await service.listMcpServers(project.id)

      expect(servers.map((server) => server.name)).toEqual(["Alpha", "Mid", "Zeta"])
    })

    it("should not return servers of other projects nor presets", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const otherProject = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(otherProject)

      await service.createMcpServer({
        projectId: project.id,
        name: "Mine",
        config: { url: "https://mine.example.com" },
      })
      await service.createMcpServer({
        projectId: otherProject.id,
        name: "Theirs",
        config: { url: "https://theirs.example.com" },
      })
      await service.createPreset("list-preset", "Preset", { url: "https://preset.example.com" })

      const servers = await service.listMcpServers(project.id)

      expect(servers.map((server) => server.name)).toEqual(["Mine"])
    })

    it("should not return soft-deleted servers", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Gone",
        config: { url: "https://gone.example.com" },
      })
      await service.deleteMcpServer(server.id)

      expect(await service.listMcpServers(project.id)).toEqual([])
    })
  })

  describe("findMcpServerById", () => {
    it("should return the server when it belongs to the project", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Found",
        config: { url: "https://found.example.com" },
      })

      const found = await service.findMcpServerById(server.id, project.id)

      expect(found?.id).toBe(server.id)
    })

    it("should return null when the server belongs to another project", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const otherProject = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(otherProject)
      const server = await service.createMcpServer({
        projectId: otherProject.id,
        name: "Elsewhere",
        config: { url: "https://elsewhere.example.com" },
      })

      expect(await service.findMcpServerById(server.id, project.id)).toBeNull()
    })

    it("should return null for a preset server", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const preset = await service.createPreset("find-preset", "Preset", {
        url: "https://preset.example.com",
      })

      expect(await service.findMcpServerById(preset.id, project.id)).toBeNull()
    })

    it("should return null for a soft-deleted server", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Deleted",
        config: { url: "https://deleted.example.com" },
      })
      await service.deleteMcpServer(server.id)

      expect(await service.findMcpServerById(server.id, project.id)).toBeNull()
    })
  })

  describe("deleteMcpServer", () => {
    it("should soft-delete the server and its agent links", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "To Delete",
        config: { url: "https://delete.example.com" },
      })
      const junction = await service.enableForAgent(agent.id, server.id)

      await service.deleteMcpServer(server.id)

      const deletedServer = await repositories.mcpServerRepository.findOne({
        where: { id: server.id },
        withDeleted: true,
      })
      expect(deletedServer?.deletedAt).not.toBeNull()

      expect(
        await repositories.agentMcpServerRepository.findOne({ where: { id: junction.id } }),
      ).toBeNull()
      const deletedJunction = await repositories.agentMcpServerRepository.findOne({
        where: { id: junction.id },
        withDeleted: true,
      })
      expect(deletedJunction?.deletedAt).not.toBeNull()

      expect(await service.getEnabledServersForAgent(agent.id)).toEqual([])
    })

    it("should leave other servers and their links untouched", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const doomed = await service.createMcpServer({
        projectId: project.id,
        name: "Doomed",
        config: { url: "https://doomed.example.com" },
      })
      const survivor = await service.createMcpServer({
        projectId: project.id,
        name: "Survivor",
        config: { url: "https://survivor.example.com" },
      })
      await service.enableForAgent(agent.id, doomed.id)
      await service.enableForAgent(agent.id, survivor.id)

      await service.deleteMcpServer(doomed.id)

      expect(await service.listMcpServers(project.id)).toHaveLength(1)
      expect(await service.getEnabledServersForAgent(agent.id)).toEqual([
        { id: survivor.id, url: "https://survivor.example.com" },
      ])
    })
  })

  describe("disableForAgent", () => {
    it("should remove the link for that agent only", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      const otherAgent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save([agent, otherAgent])
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Shared",
        config: { url: "https://shared.example.com" },
      })
      await service.enableForAgent(agent.id, server.id)
      await service.enableForAgent(otherAgent.id, server.id)

      await service.disableForAgent(agent.id, server.id)

      expect(await service.getEnabledServersForAgent(agent.id)).toEqual([])
      expect(await service.getEnabledServersForAgent(otherAgent.id)).toHaveLength(1)
      expect(
        await repositories.agentMcpServerRepository.count({ where: { mcpServerId: server.id } }),
      ).toBe(1)
    })

    it("should be a no-op when no link exists", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Unlinked",
        config: { url: "https://unlinked.example.com" },
      })

      await expect(service.disableForAgent(agent.id, server.id)).resolves.toBeUndefined()
    })
  })

  describe("getConfig", () => {
    it("should return the URL stored in the encrypted config", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Decrypt",
        config: { url: "https://decrypt.example.com/mcp", apiKey: "sk-hidden" },
      })

      expect(service.getConfig(server).url).toBe("https://decrypt.example.com/mcp")
    })
  })

  describe("enableForAgent", () => {
    it("should create an agent-mcp-server junction", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      const server = await service.createPreset("enable-test", "Test Server", {
        url: "https://example.com/mcp",
        apiKey: "sk-test-key",
      })

      const result = await service.enableForAgent(agent.id, server.id)

      expect(result.agentId).toBe(agent.id)
      expect(result.mcpServerId).toBe(server.id)
      expect(result.enabled).toBe(true)
    })
  })

  describe("enableForAgent idempotence", () => {
    it("should return the existing link when enabling twice", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Twice",
        config: { url: "https://twice.example.com" },
      })

      const first = await service.enableForAgent(agent.id, server.id)
      const second = await service.enableForAgent(agent.id, server.id)

      expect(second.id).toBe(first.id)
      expect(
        await repositories.agentMcpServerRepository.count({
          where: { agentId: agent.id, mcpServerId: server.id },
        }),
      ).toBe(1)
    })

    it("should re-enable a link that was disabled in place", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Re-enabled",
        config: { url: "https://reenabled.example.com" },
      })
      const junction = await service.enableForAgent(agent.id, server.id)
      await repositories.agentMcpServerRepository.update(junction.id, { enabled: false })

      const result = await service.enableForAgent(agent.id, server.id)

      expect(result.id).toBe(junction.id)
      expect(result.enabled).toBe(true)
      expect(await service.getEnabledServersForAgent(agent.id)).toHaveLength(1)
    })
  })

  describe("getEnabledServersForAgent", () => {
    it("should return decrypted configs for enabled servers", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      const server = await service.createPreset("get-enabled-test", "Test Server", {
        url: "https://example.com/mcp",
        apiKey: "sk-test-key",
      })
      await service.enableForAgent(agent.id, server.id)

      const configs = await service.getEnabledServersForAgent(agent.id)

      expect(configs).toHaveLength(1)
      expect(configs[0]).toEqual({
        id: server.id,
        url: "https://example.com/mcp",
        apiKey: "sk-test-key",
      })
    })

    it("should not return disabled servers", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      const server = await service.createPreset("disabled-test", "Test Server", {
        url: "https://example.com/mcp",
        apiKey: "sk-test-key",
      })
      const junction = await service.enableForAgent(agent.id, server.id)
      await repositories.agentMcpServerRepository.update(junction.id, { enabled: false })

      const configs = await service.getEnabledServersForAgent(agent.id)

      expect(configs).toHaveLength(0)
    })

    it("should return an empty list for an agent with no servers", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      expect(await service.getEnabledServersForAgent(agent.id)).toEqual([])
    })

    it("should pass static headers through from the config", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "With Headers",
        config: {
          url: "https://headers.example.com/mcp",
          headers: { "X-Api-Version": "2", "X-Tenant": "acme" },
        },
      })
      await service.enableForAgent(agent.id, server.id)

      expect(await service.getEnabledServersForAgent(agent.id)).toEqual([
        {
          id: server.id,
          url: "https://headers.example.com/mcp",
          headers: { "X-Api-Version": "2", "X-Tenant": "acme" },
        },
      ])
    })

    it("should skip a link whose server was soft-deleted directly", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Orphaned",
        config: { url: "https://orphaned.example.com" },
      })
      await service.enableForAgent(agent.id, server.id)
      await repositories.mcpServerRepository.softDelete({ id: server.id })

      expect(await service.getEnabledServersForAgent(agent.id)).toEqual([])
    })

    it("should not return servers enabled for another agent", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      const otherAgent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save([agent, otherAgent])
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Other's",
        config: { url: "https://other.example.com" },
      })
      await service.enableForAgent(otherAgent.id, server.id)

      expect(await service.getEnabledServersForAgent(agent.id)).toEqual([])
    })

    it("should return multiple servers", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)

      const server1 = await service.createPreset("multi-social", "Bayes Social", {
        url: "https://social.example.com/mcp",
        apiKey: "sk-social",
      })
      const server2 = await service.createPreset("multi-other", "Other Server", {
        url: "https://other.example.com/mcp",
      })
      await service.enableForAgent(agent.id, server1.id)
      await service.enableForAgent(agent.id, server2.id)

      const configs = await service.getEnabledServersForAgent(agent.id)

      expect(configs).toHaveLength(2)
      expect(configs).toEqual(
        expect.arrayContaining([
          { id: server1.id, url: "https://social.example.com/mcp", apiKey: "sk-social" },
          { id: server2.id, url: "https://other.example.com/mcp" },
        ]),
      )
    })

    describe("with Google IAM enabled", () => {
      beforeEach(() => {
        process.env.PDF_CONVERTER_AUTH = "google-iam"
      })

      it("should expose the IAM audience of the PDF export server", async () => {
        const agent = await createAgent()
        const server = await service.createPreset(
          PDF_EXPORT_PRESET_SLUG,
          PDF_EXPORT_BUILT_IN_NAME,
          {
            url: "https://pdf-converter.example.test/mcp",
          },
        )
        await service.enableForAgent(agent.id, server.id)

        const configs = await service.getEnabledServersForAgent(agent.id)

        expect(configs).toEqual([
          {
            id: server.id,
            url: "https://pdf-converter.example.test/mcp",
            googleIamAudience: "https://pdf-converter.example.test",
          },
        ])
      })

      it("should not expose an IAM audience for a custom server", async () => {
        const agent = await createAgent()
        const server = await service.createMcpServer({
          projectId: agent.projectId,
          name: "Custom Server",
          config: { url: "https://custom.example.com/mcp" },
        })
        await service.enableForAgent(agent.id, server.id)

        const configs = await service.getEnabledServersForAgent(agent.id)

        expect(configs).toEqual([{ id: server.id, url: "https://custom.example.com/mcp" }])
      })

      it("should not expose an IAM audience for a preset that is not built-in", async () => {
        const agent = await createAgent()
        const server = await service.createPreset(OTHER_PRESET_SLUG, "Other Preset", {
          url: "https://other-preset.example.test/mcp",
        })
        await service.enableForAgent(agent.id, server.id)

        const configs = await service.getEnabledServersForAgent(agent.id)

        expect(configs).toEqual([{ id: server.id, url: "https://other-preset.example.test/mcp" }])
      })
    })

    it("should omit the IAM audience when Google IAM is off", async () => {
      const agent = await createAgent()
      const server = await service.createPreset(PDF_EXPORT_PRESET_SLUG, PDF_EXPORT_BUILT_IN_NAME, {
        url: "https://pdf-converter.example.test/mcp",
      })
      await service.enableForAgent(agent.id, server.id)

      const configs = await service.getEnabledServersForAgent(agent.id)

      expect(configs).toEqual([{ id: server.id, url: "https://pdf-converter.example.test/mcp" }])
    })
  })

  describe("listMcpServers", () => {
    it("should list built-in servers first, then the project's own servers by name", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      await service.createMcpServer({
        projectId: project.id,
        name: "Zulu Server",
        config: { url: "https://zulu.example.com/mcp" },
      })
      await service.createMcpServer({
        projectId: project.id,
        name: "Alpha Server",
        config: { url: "https://alpha.example.com/mcp" },
      })
      await service.createPreset(PDF_EXPORT_PRESET_SLUG, PDF_EXPORT_BUILT_IN_NAME, {
        url: "https://pdf-converter.example.test/mcp",
      })

      const mcpServers = await service.listMcpServers(project.id)

      expect(mcpServers.map((mcpServer) => mcpServer.name)).toEqual([
        PDF_EXPORT_BUILT_IN_NAME,
        "Alpha Server",
        "Zulu Server",
      ])
    })

    it("should not list the servers of another project", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      await service.createMcpServer({
        projectId: otherProject.id,
        name: "Other Project Server",
        config: { url: "https://other.example.com/mcp" },
      })
      await service.createPreset(PDF_EXPORT_PRESET_SLUG, PDF_EXPORT_BUILT_IN_NAME, {
        url: "https://pdf-converter.example.test/mcp",
      })

      const mcpServers = await service.listMcpServers(project.id)

      expect(mcpServers.map((mcpServer) => mcpServer.name)).toEqual([PDF_EXPORT_BUILT_IN_NAME])
    })

    it("should not list a preset that is not built-in", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      await service.createPreset(OTHER_PRESET_SLUG, "Other Preset", {
        url: "https://other-preset.example.test/mcp",
      })

      const mcpServers = await service.listMcpServers(project.id)

      expect(mcpServers).toEqual([])
    })
  })

  describe("findMcpServerById", () => {
    it("should find a built-in server from any project", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const builtIn = await service.createPreset(PDF_EXPORT_PRESET_SLUG, PDF_EXPORT_BUILT_IN_NAME, {
        url: "https://pdf-converter.example.test/mcp",
      })

      const found = await service.findMcpServerById(builtIn.id, project.id)

      expect(found?.id).toBe(builtIn.id)
    })

    it("should not find a server of another project", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      const server = await service.createMcpServer({
        projectId: otherProject.id,
        name: "Other Project Server",
        config: { url: "https://other.example.com/mcp" },
      })

      const found = await service.findMcpServerById(server.id, project.id)

      expect(found).toBeNull()
    })

    it("should not find a preset that is not built-in", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const preset = await service.createPreset(OTHER_PRESET_SLUG, "Other Preset", {
        url: "https://other-preset.example.test/mcp",
      })

      const found = await service.findMcpServerById(preset.id, project.id)

      expect(found).toBeNull()
    })
  })

  describe("deleteMcpServer", () => {
    it("should refuse to delete a built-in server", async () => {
      const builtIn = await service.createPreset(PDF_EXPORT_PRESET_SLUG, PDF_EXPORT_BUILT_IN_NAME, {
        url: "https://pdf-converter.example.test/mcp",
      })

      await expect(service.deleteMcpServer(builtIn.id)).rejects.toThrow(
        "Built-in MCP servers cannot be deleted",
      )

      const stored = await repositories.mcpServerRepository.findOne({ where: { id: builtIn.id } })
      expect(stored).not.toBeNull()
    })

    it("should soft-delete a custom server", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const server = await service.createMcpServer({
        projectId: project.id,
        name: "Custom Server",
        config: { url: "https://custom.example.com/mcp" },
      })

      await service.deleteMcpServer(server.id)

      const stored = await repositories.mcpServerRepository.findOne({ where: { id: server.id } })
      expect(stored).toBeNull()
    })

    it("should soft-delete a preset that is not built-in", async () => {
      const preset = await service.createPreset(OTHER_PRESET_SLUG, "Other Preset", {
        url: "https://other-preset.example.test/mcp",
      })

      await service.deleteMcpServer(preset.id)

      const stored = await repositories.mcpServerRepository.findOne({ where: { id: preset.id } })
      expect(stored).toBeNull()
    })
  })
})
