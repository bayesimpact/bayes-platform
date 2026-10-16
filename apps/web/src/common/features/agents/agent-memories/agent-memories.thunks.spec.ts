import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RootState } from "@/common/store"
import type { Services } from "@/di/services"
import { isStudioInterface } from "@/studio/routes/helpers"
import { agentMemoryFactory } from "./agent-memories.factory"
import { agentMemoriesInitialState, agentMemoriesSlice } from "./agent-memories.slice"
import { listAgentMemories, resolveAgentMemoryProposals } from "./agent-memories.thunks"

vi.mock("@/studio/routes/helpers", () => ({ isStudioInterface: vi.fn() }))

const mockedIsStudioInterface = vi.mocked(isStudioInterface)

const getAll = vi.fn()
const resolveProposals = vi.fn()
const extra = { services: { agentMemories: { getAll, resolveProposals } } as unknown as Services }

const state = {
  currentIds: { organizationId: "org-1", projectId: "project-1", agentId: "agent-1" },
} as unknown as RootState

describe("agent memories thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists the playground memory in Studio", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    getAll.mockResolvedValue([])

    await listAgentMemories()(vi.fn(), () => state, extra)

    expect(getAll).toHaveBeenCalledWith({
      organizationId: "org-1",
      projectId: "project-1",
      agentId: "agent-1",
      sessionType: "playground",
    })
  })

  it("lists the live memory elsewhere (Desk)", async () => {
    mockedIsStudioInterface.mockReturnValue(false)
    getAll.mockResolvedValue([])

    await listAgentMemories()(vi.fn(), () => state, extra)

    expect(getAll).toHaveBeenCalledWith(expect.objectContaining({ sessionType: "live" }))
  })

  it("sends the user's decisions on proposals", async () => {
    mockedIsStudioInterface.mockReturnValue(false)
    resolveProposals.mockResolvedValue([])
    const decisions = [{ memoryId: "m-1", decision: "save" as const }]

    await resolveAgentMemoryProposals({ decisions })(vi.fn(), () => state, extra)

    expect(resolveProposals).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "agent-1", sessionType: "live" }),
      decisions,
    )
  })
})

describe("agent memories slice", () => {
  const reducer = agentMemoriesSlice.reducer

  it("applies the user's answer: saved proposals update, rejected ones disappear", () => {
    const kept = agentMemoryFactory.pending().build({ id: "m-1", content: "Works on weekends" })
    const rejected = agentMemoryFactory.pending().build({ id: "m-2" })
    const untouched = agentMemoryFactory.build({ id: "m-3" })
    const loaded = reducer(
      agentMemoriesInitialState,
      listAgentMemories.fulfilled([kept, rejected, untouched], "request", undefined),
    )

    const savedVersion = { ...kept, status: "saved" as const, content: "Works on Saturdays" }
    const next = reducer(
      loaded,
      resolveAgentMemoryProposals.fulfilled([savedVersion], "request", {
        decisions: [
          { memoryId: "m-1", decision: "save", content: "Works on Saturdays" },
          { memoryId: "m-2", decision: "reject" },
        ],
      }),
    )

    expect(next.data.value).toEqual([savedVersion, untouched])
  })

  it("forgets everything on unmount", () => {
    const mounted = reducer(agentMemoriesInitialState, agentMemoriesSlice.actions.mount())
    expect(mounted.mounted).toBe(true)
    expect(reducer(mounted, agentMemoriesSlice.actions.unmount())).toEqual(
      agentMemoriesInitialState,
    )
  })
})
