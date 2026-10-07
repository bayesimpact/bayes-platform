import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RootState } from "@/common/store"
import type { Services } from "@/di/services"
import { listAgents } from "./agents.thunks"

const organizationId = "org-1"
const projectId = "project-1"

const getAll = vi.fn()
const getAllWithDrafts = vi.fn()
const extra = { services: { agents: { getAll, getAllWithDrafts } } as unknown as Services }

/**
 * A fixture shaped like only the slices the thunk reads, not a full `RootState` — the real type is
 * a many-scope union not meant to be hand-built.
 */
const state = { currentIds: { organizationId, projectId } } as unknown as RootState

const run = (includeDrafts: boolean) => listAgents({ includeDrafts })(vi.fn(), () => state, extra)

beforeEach(() => {
  vi.clearAllMocks()
  getAll.mockResolvedValue([])
  getAllWithDrafts.mockResolvedValue([])
})

describe("listAgents", () => {
  it("lists the agents with their drafts when asked to", async () => {
    await run(true)

    expect(getAllWithDrafts).toHaveBeenCalledWith({ organizationId, projectId })
    expect(getAll).not.toHaveBeenCalled()
  })

  it("lists the published agents only otherwise", async () => {
    await run(false)

    expect(getAll).toHaveBeenCalledWith({ organizationId, projectId })
    expect(getAllWithDrafts).not.toHaveBeenCalled()
  })
})
