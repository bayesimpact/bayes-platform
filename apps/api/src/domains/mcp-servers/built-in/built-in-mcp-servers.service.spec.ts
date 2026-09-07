import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { McpServersModule } from "../mcp-servers.module"
import { McpServersService } from "../mcp-servers.service"
import { PDF_EXPORT_BUILT_IN_NAME, PDF_EXPORT_PRESET_SLUG } from "./built-in-mcp-servers"
import { BuiltInMcpServersService } from "./built-in-mcp-servers.service"

describe("BuiltInMcpServersService", () => {
  let service: BuiltInMcpServersService
  let mcpServersService: McpServersService
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let initialConverterUrl: string | undefined

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [McpServersModule],
    })
    await clearTestDatabase(setup.dataSource)
    repositories = setup.getAllRepositories()
    service = setup.module.get<BuiltInMcpServersService>(BuiltInMcpServersService)
    mcpServersService = setup.module.get<McpServersService>(McpServersService)
    initialConverterUrl = process.env.PDF_CONVERTER_URL
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
  })

  beforeEach(() => {
    process.env.PDF_CONVERTER_URL = "https://pdf-converter.example.test"
  })

  afterEach(async () => {
    if (initialConverterUrl === undefined) {
      delete process.env.PDF_CONVERTER_URL
    } else {
      process.env.PDF_CONVERTER_URL = initialConverterUrl
    }
    await clearTestDatabase(setup.dataSource)
  })

  describe("syncFromEnvironment", () => {
    it("should skip the PDF export server when PDF_CONVERTER_URL is not set", async () => {
      delete process.env.PDF_CONVERTER_URL

      const result = await service.syncFromEnvironment()

      expect(result).toEqual({ synced: [], skipped: [PDF_EXPORT_PRESET_SLUG] })
      const stored = await repositories.mcpServerRepository.find()
      expect(stored).toHaveLength(0)
    })

    it("should create the PDF export server pointing at the converter's mcp endpoint", async () => {
      const result = await service.syncFromEnvironment()

      expect(result).toEqual({ synced: [PDF_EXPORT_PRESET_SLUG], skipped: [] })
      const stored = await repositories.mcpServerRepository.findOneOrFail({
        where: { presetSlug: PDF_EXPORT_PRESET_SLUG },
      })
      expect(stored.name).toBe(PDF_EXPORT_BUILT_IN_NAME)
      expect(stored.projectId).toBeNull()
      expect(mcpServersService.decryptUrl(stored)).toBe("https://pdf-converter.example.test/mcp")
    })

    it("should keep the same row and update the url when the converter moves", async () => {
      const created = await service.syncFromEnvironment()
      expect(created.synced).toEqual([PDF_EXPORT_PRESET_SLUG])
      const before = await repositories.mcpServerRepository.findOneOrFail({
        where: { presetSlug: PDF_EXPORT_PRESET_SLUG },
      })

      process.env.PDF_CONVERTER_URL = "https://pdf-converter-2.example.test/"
      await service.syncFromEnvironment()

      expect(await repositories.mcpServerRepository.count()).toBe(1)
      const refreshed = await repositories.mcpServerRepository.findOneOrFail({
        where: { presetSlug: PDF_EXPORT_PRESET_SLUG },
      })
      expect(refreshed.id).toBe(before.id)
      expect(mcpServersService.decryptUrl(refreshed)).toBe(
        "https://pdf-converter-2.example.test/mcp",
      )
    })

    it("should leave an unchanged row untouched", async () => {
      await service.syncFromEnvironment()
      const before = await repositories.mcpServerRepository.findOneOrFail({
        where: { presetSlug: PDF_EXPORT_PRESET_SLUG },
      })

      await service.syncFromEnvironment()

      const after = await repositories.mcpServerRepository.findOneOrFail({
        where: { presetSlug: PDF_EXPORT_PRESET_SLUG },
      })
      expect(after.id).toBe(before.id)
      expect(after.updatedAt).toEqual(before.updatedAt)
      expect(after.encryptedConfig).toBe(before.encryptedConfig)
    })

    it("should restore a soft-deleted built-in row", async () => {
      const created = await service.ensureBuiltInServer({
        slug: PDF_EXPORT_PRESET_SLUG,
        name: PDF_EXPORT_BUILT_IN_NAME,
        config: { url: "https://pdf-converter.example.test/mcp" },
      })
      await repositories.mcpServerRepository.softDelete({ id: created.id })

      await service.syncFromEnvironment()

      const stored = await repositories.mcpServerRepository.findOneOrFail({
        where: { presetSlug: PDF_EXPORT_PRESET_SLUG },
      })
      expect(stored.id).toBe(created.id)
      expect(stored.deletedAt).toBeNull()
    })
  })
})
