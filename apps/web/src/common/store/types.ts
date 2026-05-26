import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit"
import type { BackofficeState } from "@/backoffice/store/types"
import type { DeskState } from "@/desk/store/types"
import type { Services } from "@/di/services"
import type { EvalState } from "@/eval/store/types"
import type { ReviewerState } from "@/reviewer/store/types"
import type { StudioState } from "@/studio/store/types"
import type { TesterState } from "@/tester/store/types"
import type { rootSliceList } from "./root-slices"

// Define the store state structure without creating the store
// This allows us to use these types in listenerMiddleware without circular dependencies
export type RootState =
  typeof rootSliceList extends Array<infer R>
    ? {
        // @ts-expect-error - Mapped type over array of slices to construct RootState shape
        [K in R as K["name"]]: ReturnType<K["reducer"]>
      } & StudioState &
        DeskState &
        EvalState &
        TesterState &
        ReviewerState &
        BackofficeState
    : never

// Extra argument passed to thunks for dependency injection
export type ThunkExtraArg = {
  services: Services
}

export type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export type AppDispatch = ThunkDispatch<RootState, ThunkExtraArg, UnknownAction>
