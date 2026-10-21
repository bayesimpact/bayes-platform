import type { RequestHandler } from "msw"
import { type SetupWorker, setupWorker } from "msw/browser"
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

let startedWorker: Promise<SetupWorker> | null = null

/** MSW's worker, started once for every story of the Storybook tab. */
function storyWorker(): Promise<SetupWorker> {
  startedWorker ??= (async () => {
    const worker = setupWorker()
    await worker.start({
      serviceWorker: { url: "/mockServiceWorker.js" },
      onUnhandledRequest: "bypass",
      quiet: true,
    })
    return worker
  })()
  return startedWorker
}

/**
 * Serves a story's world from the mocked API, with the same ids on every load, and returns the
 * page the story opens.
 */
export async function serveStoryWorld(parameters: DeskStoryParameters = {}): Promise<string> {
  const worker = await storyWorker()
  installStableIds()
  const world = (parameters.world ?? buildDeskWorld)()
  worker.resetHandlers(...(parameters.handlers ?? []), ...meHandlers(), ...worldHandlers(world))
  return parameters.url?.(world) ?? "/app/"
}
