import { getResponse, type RequestHandler } from "msw"
import { appBasePath } from "@/app/config"
import { installStableIds } from "../stable-ids"
import { evalHandlers } from "./handlers"

/** What a story of the whole app sets in its `evaluation` parameter. */
export type EvalStoryParameters = {
  /** Handlers that win over the default ones, built on each load so the story starts afresh. */
  handlers?: () => RequestHandler[]
  /** The page the story opens: the home by default. */
  url?: string
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

/** Serves a story from the mocked API, with the same ids on every load, and returns its page. */
export function serveStoryWorld(parameters: EvalStoryParameters = {}): string {
  mockFetch()
  installStableIds()
  storyHandlers = [...(parameters.handlers?.() ?? []), ...evalHandlers()]
  return parameters.url ?? appBasePath
}
