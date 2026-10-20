import { beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import type { Services } from "@/di/services"
import { duplicateAgent } from "./agents.thunks"

const organizationId = "org-1"
const projectId = "project-1"

const duplicateOne = vi.fn()
const extra = { services: { agents: { duplicateOne } } as unknown as Services }

/**
 * A fixture shaped like only the slices the thunk reads, not a full `RootState` — the real type is
 * a many-scope union not meant to be hand-built.
 */
const state = { currentIds: { organizationId, projectId } } as unknown as RootState

beforeEach(() => {
  vi.clearAllMocks()
})

describe("duplicateAgent", () => {
  it("copies the agent within the current project and returns the copy", async () => {
    const project = projectFactory.transient({ organization: organizationFactory.build() }).build()
    const copy = agentFactory.unpublished().transient({ project }).build()
    duplicateOne.mockResolvedValue(copy)

    const action = await duplicateAgent({
      agentId: "agent-1",
      fields: { name: "Helpful Assistant (copy)" },
    })(vi.fn(), () => state, extra)

    expect(duplicateOne).toHaveBeenCalledWith(
      { organizationId, projectId, agentId: "agent-1" },
      { name: "Helpful Assistant (copy)" },
    )
    expect(action.payload).toBe(copy)
  })
})
