import { combineReducers, configureStore, type Reducer } from "@reduxjs/toolkit"
import type { Decorator } from "@storybook/react-vite"
import type { JSX } from "react"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { backofficeSliceList } from "@/backoffice/store/slices"
import { selectCurrentAgentSessionId } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { selectCurrentReviewerSessionId } from "@/common/features/review-campaigns/current-reviewer-session-id/current-reviewer-session-id.selectors"
import type { RootState } from "@/common/store"
import { useAppSelector } from "@/common/store/hooks"
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

const allMockSlices: ReadonlyArray<Slice> = [
  ...rootSliceList,
  ...studioSliceList,
  ...testerSliceList,
  ...reviewerSliceList,
  ...evalSliceList,
  ...backofficeSliceList,
]

// Scope-specific slices share names (e.g. every scope has a `currentIds` slice). Later entries
// win, but reducers handling identical action types make the behavior equivalent at runtime.
const mockReducerMap = Object.assign(
  {},
  ...allMockSlices.map((slice) => ({ [slice.name]: slice.reducer })),
)

const mockRootReducer = combineReducers(mockReducerMap) as unknown as Reducer<RootState>

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

export function buildDecorator<TArgs>(build: (args: TArgs) => WithReduxConfig): Decorator {
  return (Story, ctx) => {
    const store = buildMockStore(build(ctx.args as TArgs))
    return (
      <Provider store={store}>
        <Story />
      </Provider>
    )
  }
}

type Route = {
  path?: string
  element: JSX.Element
  children?: Route[]
}
export function render({ path, routes }: { routes: Route; path: string }) {
  return () => {
    const resolvedPath = useReplaceIds(path)
    const router = createMemoryRouter([routes], { initialEntries: [resolvedPath] })
    // Key forces remount on path change, ensuring selectors re-run with updated params
    return <RouterProvider key={resolvedPath} router={router} />
  }
}

function useReplaceIds(path: string) {
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)
  const agentId = useAppSelector(selectCurrentAgentId)
  const agentSessionId = useAppSelector(selectCurrentAgentSessionId)
  const reviewCampaignId = useAppSelector(selectCurrentReviewCampaignId)
  const reviewerSessionId = useAppSelector(selectCurrentReviewerSessionId)

  if (organizationId) path = path.replace(":organizationId", organizationId)
  if (projectId) path = path.replace(":projectId", projectId)
  if (agentId) path = path.replace(":agentId", agentId)
  if (agentSessionId) path = path.replace(":agentSessionId", agentSessionId)
  if (reviewCampaignId) path = path.replace(":reviewCampaignId", reviewCampaignId)
  if (reviewerSessionId) path = path.replace(":reviewerSessionId", reviewerSessionId)

  return path
}
