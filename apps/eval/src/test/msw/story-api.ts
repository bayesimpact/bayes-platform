import { getResponse, type RequestHandler } from "msw"
import { appBasePath } from "@/app/config"
import { forgetLastAgent } from "@/features/agents"
import { appUpdate } from "@/lib/app-update"
import { buildEvalWorld, type EvalWorld } from "../factories/eval-world.factory"
import { installStableIds } from "../stable-ids"
import { evalHandlers } from "./handlers"

/** What a story of the whole app sets in its `evaluation` parameter. */
export type EvalStoryParameters = {
  /** The world the mocked API answers from: the main case by default. */
  world?: () => EvalWorld
  /** Handlers that win over the world's, built on each load so the story starts afresh. */
  handlers?: () => RequestHandler[]
  /** The page the story opens: the home by default. */
  url?: (world: EvalWorld) => string
}

/** The `parameters` of a story of the whole app, typed. */
export const evaluation = (parameters: EvalStoryParameters = {}) => ({ evaluation: parameters })

/** The handlers of the story on screen. */
let storyHandlers: RequestHandler[] = []
let isFetchMocked = false

/**
 * Answers the app's requests from the story's handlers, through MSW's `getResponse`, and lets
 * the others reach the network. No Service Worker: the browser of Claude Desktop cannot register
 * one, and every request of the app goes through `fetch`.
 */
function mockFetch(): void {
  if (isFetchMocked) return
  isFetchMocked = true
  const networkFetch = window.fetch.bind(window)
  const storyFetch: typeof window.fetch = async (input, init) => {
    const request = new Request(input, init)
    const response = await getResponse(storyHandlers, request.clone())
    return response ?? networkFetch(request)
  }
  // Defined rather than assigned: another interceptor, such as MSW's server when the tests render
  // the stories, may have made `fetch` read-only.
  Object.defineProperty(window, "fetch", { value: storyFetch, configurable: true, writable: true })
}

/**
 * Serves a story's world from the mocked API, with the same ids on every load and no agent
 * remembered from another story, and returns the page the story opens.
 */
export function serveStoryWorld(parameters: EvalStoryParameters = {}): string {
  mockFetch()
  // The agent a previous story left open would decide which one this story opens.
  forgetLastAgent()
  // A new release a previous story announced would show its banner here too.
  appUpdate.reset()
  installStableIds()
  const world = (parameters.world ?? buildEvalWorld)()
  storyHandlers = [...(parameters.handlers?.() ?? []), ...evalHandlers(world)]
  return parameters.url?.(world) ?? appBasePath
}
