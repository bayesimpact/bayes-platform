import { combineReducers, configureStore, type Reducer } from "@reduxjs/toolkit"
import type { Decorator } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { backofficeSliceList } from "@/backoffice/store/slices"
import type { RootState } from "@/common/store"
import { rootSliceList } from "@/common/store/root-slices"
import type { Services } from "@/di/services"
import { evalSliceList } from "@/eval/store/slices"
import { reviewerSliceList } from "@/reviewer/store/slices"
import { studioSliceList } from "@/studio/store/slices"
import { testerSliceList } from "@/tester/store/slices"

export type DeepPartial<T> =
  T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T

export type StoryPreloadedState = DeepPartial<RootState>

export type WithReduxConfig = {
  /** Partial RootState to seed. Compose with helpers from `@/stories/seed` or pass any slice fragment directly. */
  state?: StoryPreloadedState
  /** Partial services injected as `thunk.extraArgument.services`. Missing services throw when their thunks run. */
  services?: Partial<Services>
}

type Slice = { name: string; reducer: Reducer }

function combineSliceList(slices: ReadonlyArray<Slice>): Reducer {
  return combineReducers(
    Object.assign({}, ...slices.map((slice) => ({ [slice.name]: slice.reducer }))),
  )
}

const mockRootReducer = combineReducers({
  ...Object.assign({}, ...rootSliceList.map((slice) => ({ [slice.name]: slice.reducer }))),
  studio: combineSliceList(studioSliceList),
  tester: combineSliceList(testerSliceList),
  reviewer: combineSliceList(reviewerSliceList),
  evaluation: combineSliceList(evalSliceList),
  backoffice: combineSliceList(backofficeSliceList),
}) as unknown as Reducer<RootState>

const defaultInitialState = mockRootReducer(undefined, { type: "@@INIT" })

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source === undefined ? target : (source as T)
  }
  const merged: Record<string, unknown> = { ...target }
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    const current = (target as Record<string, unknown>)[key]
    merged[key] =
      isPlainObject(current) && isPlainObject(value)
        ? deepMerge(current, value as DeepPartial<typeof current>)
        : value
  }
  return merged as T
}

export function buildMockStore({ state, services }: WithReduxConfig = {}) {
  const preloadedState = state ? deepMerge(defaultInitialState, state) : defaultInitialState
  return configureStore({
    reducer: mockRootReducer,
    preloadedState,
    middleware: (getDefault) =>
      services
        ? getDefault({
            thunk: { extraArgument: { services: services as Services } },
            serializableCheck: false,
          })
        : getDefault({ thunk: false, serializableCheck: false }),
  })
}

export function withRedux(config: WithReduxConfig = {}): Decorator {
  const store = buildMockStore(config)
  return (Story) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}
