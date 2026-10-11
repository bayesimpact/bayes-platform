import { describe, expect, it, vi } from "vitest"
import { ADS } from "@/common/store/async-data-status"
import type { RootState } from "@/common/store/types"
import type { Services } from "@/di/services"
import { agentModelsCatalogFactory } from "./agent-settings.factory"
import { selectAvailableModelsCatalog } from "./agent-settings.selectors"
import { listAvailableModels } from "./agent-settings.thunks"

const catalog = agentModelsCatalogFactory.build()

/** A fixture shaped like only the slices read here, not a full `RootState`. */
const stateWith = (slices: Record<string, unknown>) => slices as unknown as RootState

describe("selectAvailableModelsCatalog", () => {
  it("returns the catalog once loaded", () => {
    expect(
      selectAvailableModelsCatalog(
        stateWith({
          agentSettings: {
            availableModels: { status: ADS.Fulfilled, error: null, value: catalog },
          },
        }),
      ),
    ).toBe(catalog)
  })

  it("returns null while the catalog loads", () => {
    expect(
      selectAvailableModelsCatalog(
        stateWith({
          agentSettings: { availableModels: { status: ADS.Loading, error: null, value: null } },
        }),
      ),
    ).toBeNull()
  })

  it("returns null in an interface that does not load the catalog", () => {
    expect(selectAvailableModelsCatalog(stateWith({}))).toBeNull()
  })
})

describe("listAvailableModels", () => {
  it("fetches the catalog of the current project", async () => {
    const getAll = vi.fn().mockResolvedValue(catalog)
    const extra = {
      services: { agentSettings: { getAvailableModels: getAll } } as unknown as Services,
    }

    const action = await listAvailableModels()(
      vi.fn(),
      () => stateWith({ currentIds: { organizationId: "org-1", projectId: "project-1" } }),
      extra,
    )

    expect(getAll).toHaveBeenCalledWith({ organizationId: "org-1", projectId: "project-1" })
    expect(action.payload).toBe(catalog)
  })
})
