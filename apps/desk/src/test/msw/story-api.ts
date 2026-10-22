import { getResponse, type RequestHandler } from "msw"
import { buildDeskWorld, type DeskWorld } from "../factories/desk-world.factory"
import { installStableIds } from "../stable-ids"
import { meHandlers, worldHandlers } from "./handlers"

/** What a story of the whole Desk sets in its `desk` parameter. */
export type DeskStoryParameters = {
  /** The world the mocked API answers from: the main case by default. */
  world?: () => DeskWorld
  /** Handlers that win over the world's, such as a failure or an answer that never comes. */
  handlers?: RequestHandler[]
  /** The page the story opens: the home by default. */
  url?: (world: DeskWorld) => string
}

/** The handlers of the story on screen. */
let storyHandlers: RequestHandler[] = []
let isFetchMocked = false

/**
 * Answers the Desk's requests from the story's handlers, through MSW's `getResponse`, and lets
 * the others reach the network. No Service Worker: the browser of Claude Desktop cannot register
 * one, and every request of the Desk goes through `fetch`.
 */
function mockFetch(): void {
  if (isFetchMocked) return
  isFetchMocked = true
  const networkFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const request = new Request(input, init)
    const response = await getResponse(storyHandlers, request.clone())
    return response ?? networkFetch(request)
  }
}

/**
 * Serves a story's world from the mocked API, with the same ids on every load and no agent
 * remembered from another story, and returns the page the story opens.
 */
export function serveStoryWorld(parameters: DeskStoryParameters = {}): string {
  mockFetch()
  // The agent a previous story left open would decide which one this story opens.
  try {
    window.localStorage.removeItem("desk.lastAgentId")
  } catch {
    // Blocked storage keeps nothing from one story to the next anyway.
  }
  installStableIds()
  const world = (parameters.world ?? buildDeskWorld)()
  storyHandlers = [...(parameters.handlers ?? []), ...meHandlers(), ...worldHandlers(world)]
  return parameters.url?.(world) ?? "/app/"
}
