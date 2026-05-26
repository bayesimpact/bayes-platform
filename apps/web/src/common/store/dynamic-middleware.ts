import {
  type Action,
  createDynamicMiddleware,
  type ListenerMiddlewareInstance,
} from "@reduxjs/toolkit"
import { rootSlices } from "./root-slices"
import type { AppDispatch, RootState } from "./types"

export const dynamicMiddleware = createDynamicMiddleware()

type FeatureMiddleware = {
  listenerMiddleware: ListenerMiddlewareInstance<RootState, AppDispatch>
  registerListeners: () => void
}

type FeatureSlice = {
  name: string
  actions: {
    reset: () => Action
  }
}

export const createSliceManager = ({
  middlewares,
  slices,
}: {
  middlewares: FeatureMiddleware[]
  slices: FeatureSlice[]
}) => {
  let middlewareInjected = false

  function injectSlices() {
    const rr = rootSlices.withLazyLoadedSlices()
    slices.forEach((slice) => {
      // @ts-expect-error — slice.name not statically known in RootState
      rr.inject(slice, { overrideExisting: true })
    })

    // Middleware: addMiddleware is NOT idempotent — guard against duplicate registration
    if (!middlewareInjected) {
      middlewareInjected = true
      middlewares.forEach((m) => {
        dynamicMiddleware.addMiddleware(m.listenerMiddleware.middleware)
        m.registerListeners()
      })
    }
  }

  function resetSlices(dispatch: AppDispatch) {
    middlewareInjected = false // reset the guard so middleware can be re-added
    slices.forEach((slice) => {
      dispatch(slice.actions.reset())
    })
    middlewares.forEach((m) => {
      m.listenerMiddleware.clearListeners()
    })
  }

  return {
    injectSlices,
    resetSlices,
  }
}
