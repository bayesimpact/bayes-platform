import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
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
