import { configureStore, type Reducer } from "@reduxjs/toolkit"
import { authMiddleware } from "@/common/features/auth/auth.middleware"
import { meMiddleware } from "@/common/features/me/me.middleware"
import { getServices } from "@/di/services"
import { organizationsMiddleware } from "../features/organizations/organizations.middleware"
import { projectsMiddleware } from "../features/projects/projects.middleware"
import { dynamicMiddleware } from "./dynamic-middleware"
import { rootSlices } from "./root-slices"
import type { RootState, ThunkExtraArg } from "./types"

// The rootSlices uses combineSlices with lazy-loaded studio slices (optional in its type).
// We cast to Reducer<RootState> because RootState keeps all slices as required —
// studio selectors are only called from studio routes where injectStudioSlices() has run.
export const buildStore = () =>
  configureStore({
    reducer: rootSlices as unknown as Reducer<RootState>,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: {
          extraArgument: { services: getServices() } satisfies ThunkExtraArg,
        },
      }).prepend(
        dynamicMiddleware.middleware,
        authMiddleware.middleware,
        meMiddleware.middleware,
        organizationsMiddleware.middleware,
        projectsMiddleware.middleware,
      ),
  })
export const store = buildStore()

// Re-export types for convenience (they're defined in types.ts to avoid circular deps)
export type { AppDispatch, RootState, ThunkExtraArg } from "./types"
