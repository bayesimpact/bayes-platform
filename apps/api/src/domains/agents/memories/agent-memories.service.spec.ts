import { AGENT_MEMORY_MAX_SAVED_PER_USER, AgentMemoryMode } from "@caseai-connect/api-contracts"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals"
import { v4 } from "uuid"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { AgentMemoriesService } from "./agent-memories.service"
import { AgentMemoriesStoreModule } from "./agent-memories-store.module"
import { agentMemoryFactory } from "./agent-memory.factory"
import type { AgentMemoryOwner } from "./agent-memory.repository"

describe("AgentMemoriesService", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let service: AgentMemoriesService

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [AgentMemoriesStoreModule] })
    repositories = setup.getAllRepositories()
    service = setup.module.get(AgentMemoriesService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const createContext = async () => {
    const context = await createOrganizationWithAgent(repositories)
    const owner: AgentMemoryOwner = {
      agentId: context.agent.id,
      userId: context.user.id,
      sessionType: "live",
    }
    return {
      ...context,
      connectScope: { organizationId: context.organization.id, projectId: context.project.id },
      owner,
    }
  }

  const save = (
    context: Awaited<ReturnType<typeof createContext>>,
    memoryMode: AgentMemoryMode,
    items: { content: string; origin: "user_request" | "inferred" }[],
  ) =>
    service.saveFromTool({
      connectScope: context.connectScope,
      owner: context.owner,
      memoryMode,
      sourceSessionId: v4(),
      items,
    })

  describe("saveFromTool", () => {
    it("in ask mode, saves what the user asked for and proposes what the agent inferred", async () => {
      const context = await createContext()

      const result = await save(context, AgentMemoryMode.Ask, [
        { content: "Prefers short answers", origin: "user_request" },
        { content: "Works on weekends", origin: "inferred" },
      ])

      expect(result.memories.map((memory) => [memory.content, memory.status])).toEqual([
        ["Prefers short answers", "saved"],
        ["Works on weekends", "pending"],
      ])
      expect(result.error).toBeUndefined()
    })

    it("in auto mode, saves inferred facts directly", async () => {
      const context = await createContext()

      const result = await save(context, AgentMemoryMode.Auto, [
        { content: "Works on weekends", origin: "inferred" },
      ])

      expect(result.memories.map((memory) => memory.status)).toEqual(["saved"])
    })

    it("in off mode, saves nothing", async () => {
      const context = await createContext()

      const result = await save(context, AgentMemoryMode.Off, [
        { content: "Prefers short answers", origin: "user_request" },
      ])

      expect(result.memories).toEqual([])
      expect(await repositories.agentMemoryRepository.count()).toBe(0)
    })

    it("does not store the same fact twice", async () => {
      const context = await createContext()
      await save(context, AgentMemoryMode.Auto, [
        { content: "Prefers short answers", origin: "user_request" },
      ])

      const result = await save(context, AgentMemoryMode.Auto, [
        { content: "  prefers   SHORT answers ", origin: "user_request" },
      ])

      expect(result.memories).toEqual([])
      expect(await repositories.agentMemoryRepository.count()).toBe(1)
    })

    it("refuses facts that are too long, and tells the model why", async () => {
      const context = await createContext()

      const result = await save(context, AgentMemoryMode.Auto, [
        { content: "x".repeat(301), origin: "user_request" },
      ])

      expect(result.memories).toEqual([])
      expect(result.error).toContain("too long")
    })

    it("refuses new facts once the memory is full", async () => {
      const context = await createContext()
      const { organization, project, agent, user } = context
      await repositories.agentMemoryRepository.save(
        Array.from({ length: AGENT_MEMORY_MAX_SAVED_PER_USER }, () =>
          agentMemoryFactory.transient({ organization, project, agent, user }).build(),
        ),
      )

      const result = await save(context, AgentMemoryMode.Auto, [
        { content: "One more fact", origin: "user_request" },
      ])

      expect(result.memories).toEqual([])
      expect(result.error).toContain("Memory is full")
    })

    it("keeps playground and live memories apart", async () => {
      const context = await createContext()
      await save(context, AgentMemoryMode.Auto, [
        { content: "Prefers short answers", origin: "user_request" },
      ])

      const playground = await service.listForOwner(context.connectScope, {
        ...context.owner,
        sessionType: "playground",
      })

      expect(playground).toEqual([])
    })
  })

  describe("deleteExpired", () => {
    it("deletes saved facts untouched for 180 days and proposals older than 7 days", async () => {
      const { organization, project, agent, user } = await createContext()
      const memory = agentMemoryFactory.transient({ organization, project, agent, user })
      const now = new Date("2026-10-01T00:00:00Z")
      const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      await repositories.agentMemoryRepository.save([
        memory.build({ content: "old saved", updatedAt: daysAgo(181) }),
        memory.build({ content: "recent saved", updatedAt: daysAgo(10) }),
        memory.pending().build({ content: "old proposal", createdAt: daysAgo(8) }),
        memory.pending().build({ content: "recent proposal", createdAt: daysAgo(1) }),
      ])
      // updated_at is set by the database on save: put the test dates back.
      for (const [content, days] of [
        ["old saved", 181],
        ["recent saved", 10],
      ] as const) {
        await repositories.agentMemoryRepository.update({ content }, { updatedAt: daysAgo(days) })
      }

      const deleted = await service.deleteExpired(now)

      expect(deleted).toBe(2)
      const remaining = await repositories.agentMemoryRepository.find()
      expect(remaining.map((item) => item.content).sort()).toEqual([
        "recent proposal",
        "recent saved",
      ])
    })
  })
})
