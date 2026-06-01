import { afterAll } from "@jest/globals"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentsModule } from "../agents.module"
import { ProjectAgentCategoriesService } from "./project-agent-categories.service"
import { ProjectAgentCategory } from "./project-agent-category.entity"

describe("ProjectAgentCategoriesService", () => {
  let service: ProjectAgentCategoriesService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

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
    service = setup.module.get<ProjectAgentCategoriesService>(ProjectAgentCategoriesService)
  })

  describe("addProjectAgentCategory", () => {
    it("should create a new category", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const category = await service.addProjectAgentCategory(project.id, "Support")

      expect(category.name).toBe("Support")
      expect(category.id).toBeDefined()
    })

    it("should trim whitespace from the category name", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const category = await service.addProjectAgentCategory(project.id, "  Sales  ")

      expect(category.name).toBe("Sales")
    })

    it("should restore a previously soft-deleted category instead of creating a duplicate", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const created = await service.addProjectAgentCategory(project.id, "Support")
      await service.deleteProjectAgentCategory(project.id, created.id)

      const restored = await service.addProjectAgentCategory(project.id, "Support")

      expect(restored.id).toBe(created.id)
      expect(restored.name).toBe("Support")
    })

    it("should return the existing active category if already exists", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const first = await service.addProjectAgentCategory(project.id, "Support")
      const second = await service.addProjectAgentCategory(project.id, "Support")

      expect(second.id).toBe(first.id)
    })
  })

  describe("deleteProjectAgentCategory", () => {
    it("should soft-delete a category", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const category = await service.addProjectAgentCategory(project.id, "Support")
      await service.deleteProjectAgentCategory(project.id, category.id)

      const deleted = await setup
        .getRepository(ProjectAgentCategory)
        .findOne({ where: { id: category.id }, withDeleted: true })
      expect(deleted?.deletedAt).not.toBeNull()
    })

    it("should do nothing if the category does not exist", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      await expect(
        service.deleteProjectAgentCategory(project.id, "non-existent-id"),
      ).resolves.not.toThrow()
    })
  })
})
