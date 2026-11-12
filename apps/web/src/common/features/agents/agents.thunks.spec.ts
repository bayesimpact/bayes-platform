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

  it("rejects an answer that arrives after a newer request was sent", async () => {
    // The agents slice keeps the id of the last request sent; the dispatch below plays its part.
    let latestListRequestId: string | null = null
    const dispatch = vi.fn((action: unknown) => {
      if (listAgents.pending.match(action)) latestListRequestId = action.meta.requestId
    })
    const getState = () => ({ ...state, agents: { latestListRequestId } }) as unknown as RootState
    getAllWithDrafts
      .mockResolvedValueOnce(["agent-1"])
      .mockResolvedValueOnce(["agent-1", "agent-2"])

    // Both requests are sent before either answer is read.
    const olderRequest = listAgents({ includeDrafts: true })(dispatch, getState, extra)
    const newerRequest = listAgents({ includeDrafts: true })(dispatch, getState, extra)

    expect(listAgents.fulfilled.match(await newerRequest)).toBe(true)
    expect(listAgents.rejected.match(await olderRequest)).toBe(true)
  })
})
