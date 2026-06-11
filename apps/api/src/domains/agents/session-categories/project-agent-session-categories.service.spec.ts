import { afterAll } from "@jest/globals"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentsModule } from "../agents.module"
import { ProjectAgentSessionCategoriesService } from "./project-agent-session-categories.service"
import { ProjectAgentSessionCategory } from "./project-agent-session-category.entity"

describe("ProjectAgentSessionCategoriesService", () => {
  let service: ProjectAgentSessionCategoriesService
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
    service = setup.module.get<ProjectAgentSessionCategoriesService>(
      ProjectAgentSessionCategoriesService,
    )
  })

  describe("addProjectAgentSessionCategory", () => {
    it("should create a new category", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const category = await service.addProjectAgentSessionCategory(project.id, "Support", false)

      expect(category.name).toBe("Support")
      expect(category.id).toBeDefined()
    })

    it("should trim whitespace from the category name", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const category = await service.addProjectAgentSessionCategory(project.id, "  Sales  ", false)

      expect(category.name).toBe("Sales")
    })

    it("should restore a previously soft-deleted category instead of creating a duplicate", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const created = await service.addProjectAgentSessionCategory(project.id, "Support", false)
      await service.deleteProjectAgentSessionCategory(project.id, created.id)

      const restored = await service.addProjectAgentSessionCategory(project.id, "Support", false)

      expect(restored.id).toBe(created.id)
      expect(restored.name).toBe("Support")
    })

    it("should return the existing active category if already exists", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const first = await service.addProjectAgentSessionCategory(project.id, "Support", false)
      const second = await service.addProjectAgentSessionCategory(project.id, "Support", false)

      expect(second.id).toBe(first.id)
    })
  })

  describe("deleteProjectAgentSessionCategory", () => {
    it("should soft-delete a category", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      const category = await service.addProjectAgentSessionCategory(project.id, "Support", false)
      await service.deleteProjectAgentSessionCategory(project.id, category.id)

      const deleted = await setup
        .getRepository(ProjectAgentSessionCategory)
        .findOne({ where: { id: category.id }, withDeleted: true })
      expect(deleted?.deletedAt).not.toBeNull()
    })

    it("should do nothing if the category does not exist", async () => {
      const { project } = await createOrganizationWithProject(setup.getAllRepositories())

      await expect(
        service.deleteProjectAgentSessionCategory(project.id, "non-existent-id"),
      ).resolves.not.toThrow()
    })
  })
})
