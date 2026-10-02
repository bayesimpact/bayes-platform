import { configureStore, type Reducer } from "@reduxjs/toolkit"
import { describe, expect, it, vi } from "vitest"
import type { RootState } from "@/common/store/types"
import type { Services } from "@/di/services"
import { authMiddleware } from "./auth.middleware"
import { authActions } from "./auth.slice"

// The thunks reach the OIDC client transitively, which does not exist under vitest's node environment.
vi.mock("@/external/oidcClient", () => ({ logout: vi.fn() }))

function buildStore() {
  const services = {
    me: { getMe: vi.fn().mockResolvedValue({ id: "user-1" }) },
    organizations: { list: vi.fn().mockResolvedValue([]) },
    projects: { getAllMine: vi.fn().mockResolvedValue([]) },
  }
  const store = configureStore({
    reducer: ((state = {}) => state) as unknown as Reducer<RootState>,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: { services: services as unknown as Services } },
      }).prepend(authMiddleware.middleware),
  })
  return { store, services }
}

describe("authMiddleware", () => {
  it("loads the projects of every organization on sign-in, so app gates can resolve on a deep link", async () => {
    const { store, services } = buildStore()

    store.dispatch(authActions.setAuthenticated(true))

    await vi.waitFor(() => expect(services.projects.getAllMine).toHaveBeenCalledTimes(1))
    expect(services.me.getMe).toHaveBeenCalledTimes(1)
    expect(services.organizations.list).toHaveBeenCalledTimes(1)
  })
})
