import { afterAll } from "@jest/globals"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentsModule } from "../agents.module"
import { AgentSessionCategoriesService } from "./agent-session-categories.service"
import { ProjectSessionCategory } from "./project-session-category.entity"

describe("AgentSessionCategoriesService", () => {
  let service: AgentSessionCategoriesService
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
    service = setup.module.get<AgentSessionCategoriesService>(AgentSessionCategoriesService)
    repositories = setup.getAllRepositories()
  })

  describe("replaceActiveCategoriesForAgent", () => {
    it("should create categories and list them", async () => {
      const { agent, project } = await createOrganizationWithAgent(repositories)
      const alphaCategory = await setup
        .getRepository(ProjectSessionCategory)
        .save({ projectId: project.id, name: "alpha" })
      const betaCategory = await setup
        .getRepository(ProjectSessionCategory)
        .save({ projectId: project.id, name: "beta" })

      const result = await service.replaceActiveCategoriesForAgent(agent.id, [
        alphaCategory,
        betaCategory,
      ])

      expect(result.createdCount).toBe(2)
      expect(result.restoredCount).toBe(0)
      expect(result.deletedCount).toBe(0)

      const names = await service.listActiveCategoryNamesForAgent(agent.id)
      expect(names).toEqual(["alpha", "beta"])
    })

    it("should soft-delete categories not in the replacement set", async () => {
      const { agent, project } = await createOrganizationWithAgent(repositories)
      const keepCategory = await setup
        .getRepository(ProjectSessionCategory)
        .save({ projectId: project.id, name: "keep" })
      const removeMeCategory = await setup
        .getRepository(ProjectSessionCategory)
        .save({ projectId: project.id, name: "remove-me" })

      await service.replaceActiveCategoriesForAgent(agent.id, [keepCategory, removeMeCategory])
      const result = await service.replaceActiveCategoriesForAgent(agent.id, [keepCategory])

      expect(result.deletedCount).toBe(1)
      const names = await service.listActiveCategoryNamesForAgent(agent.id)
      expect(names).toEqual(["keep"])
    })

    it("should restore a soft-deleted category when it is included again", async () => {
      const { agent, project } = await createOrganizationWithAgent(repositories)
      const restoredCategory = await setup
        .getRepository(ProjectSessionCategory)
        .save({ projectId: project.id, name: "restored" })
      const goneCategory = await setup
        .getRepository(ProjectSessionCategory)
        .save({ projectId: project.id, name: "gone" })

      await service.replaceActiveCategoriesForAgent(agent.id, [restoredCategory, goneCategory])
      await service.replaceActiveCategoriesForAgent(agent.id, [goneCategory])
      const result = await service.replaceActiveCategoriesForAgent(agent.id, [
        restoredCategory,
        goneCategory,
      ])

      expect(result.restoredCount).toBe(1)
      const names = await service.listActiveCategoryNamesForAgent(agent.id)
      expect(names).toEqual(["gone", "restored"])
    })
  })
})
