import { combineReducers, configureStore, createAction, type Reducer } from "@reduxjs/toolkit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ADS, defaultAsyncData } from "@/common/store/async-data-status"
import type { RootState } from "@/common/store/types"
import type { Services } from "@/di/services"
import { agentModelsCatalogFactory } from "./agent.factory"
import { createAgentsMiddleware } from "./agents.middleware"
import { selectAvailableModelsCatalog } from "./agents.selectors"
import { agentsActions, agentsSlice } from "./agents.slice"
import { listAvailableModels } from "./agents.thunks"

// `listAgents` reads the app pathname, and `window` does not exist under vitest's node environment.
vi.mock("@/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/runtime-config")>()),
  getAppPathname: () => "/studio",
}))

const catalog = agentModelsCatalogFactory.build()

/** A fixture shaped like only the slices read here, not a full `RootState`. */
const stateWith = (slices: Record<string, unknown>) => slices as unknown as RootState

describe("selectAvailableModelsCatalog", () => {
  it("returns the catalog once loaded", () => {
    expect(
      selectAvailableModelsCatalog(
        stateWith({
          agents: { availableModels: { status: ADS.Fulfilled, error: null, value: catalog } },
        }),
      ),
    ).toBe(catalog)
  })

  it("returns null while the catalog loads", () => {
    expect(
      selectAvailableModelsCatalog(
        stateWith({
          agents: { availableModels: { status: ADS.Loading, error: null, value: null } },
        }),
      ),
    ).toBeNull()
  })

  it("returns null before a route mounts the catalog", () => {
    expect(
      selectAvailableModelsCatalog(stateWith({ agents: { availableModels: defaultAsyncData } })),
    ).toBeNull()
  })
})

describe("listAvailableModels", () => {
  it("fetches the catalog of the current project", async () => {
    const getAll = vi.fn().mockResolvedValue(catalog)
    const extra = {
      services: { agents: { getAvailableModels: getAll } } as unknown as Services,
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

describe("agentsMiddleware", () => {
  const agentsMiddleware = createAgentsMiddleware({ includeDrafts: true })
  const switchProject = createAction<string>("test/switchProject")
  const projects = [{ id: "project-1" }, { id: "project-2" }]

  /** A store holding only the slices the listeners read, with the real agents reducer. */
  function buildStore(getAvailableModels: ReturnType<typeof vi.fn>) {
    const services = {
      agents: { getAvailableModels, getAllWithDrafts: vi.fn().mockResolvedValue([]) },
    } as unknown as Services
    const store = configureStore({
      reducer: combineReducers({
        agents: agentsSlice.reducer,
        projects: (state = { data: { status: ADS.Fulfilled, error: null, value: projects } }) =>
          state,
        currentIds: (
          state = { organizationId: "org-1", projectId: "project-1" },
          action: { type: string; payload?: unknown },
        ) => (switchProject.match(action) ? { ...state, projectId: action.payload } : state),
      }) as unknown as Reducer<RootState>,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ thunk: { extraArgument: { services } } }).prepend(
          agentsMiddleware.listenerMiddleware.middleware,
        ),
    })
    agentsMiddleware.registerListeners()
    return store
  }

  afterEach(() => {
    agentsMiddleware.listenerMiddleware.clearListeners()
  })

  it("loads the catalog when a route mounts it", async () => {
    const getAvailableModels = vi.fn().mockResolvedValue(catalog)
    const store = buildStore(getAvailableModels)

    store.dispatch(agentsActions.mountAvailableModels())

    await vi.waitFor(() =>
      expect(selectAvailableModelsCatalog(store.getState() as RootState)).toBe(catalog),
    )
    expect(getAvailableModels).toHaveBeenCalledWith({
      organizationId: "org-1",
      projectId: "project-1",
    })
  })

  it("does not load the catalog on a project change alone, so Desk never fetches it", async () => {
    const getAvailableModels = vi.fn().mockResolvedValue(catalog)
    const store = buildStore(getAvailableModels)

    store.dispatch(switchProject("project-2"))

    await vi.waitFor(() => expect(store.getState().agents.data.status).toBe(ADS.Fulfilled))
    expect(getAvailableModels).not.toHaveBeenCalled()
  })
})
