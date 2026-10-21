import { setupWorker } from "msw/browser"
import { appBasePath } from "@/app/config"
import { installStableIds } from "../stable-ids"

const SCENARIO_KEY = "desk.mockScenario"

/**
 * The scenario of the mock mode: the `mock` parameter when the URL has one, else the one this tab
 * chose before, so a reload deep in the Desk keeps it. `?mock=default` goes back to the main case.
 */
function readScenario(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("mock")
  try {
    if (fromUrl === "default") sessionStorage.removeItem(SCENARIO_KEY)
    else if (fromUrl) sessionStorage.setItem(SCENARIO_KEY, fromUrl)
    return sessionStorage.getItem(SCENARIO_KEY)
  } catch {
    // Storage can be blocked: the scenario then lasts until the next reload.
    return fromUrl === "default" ? null : fromUrl
  }
}

/** Serves the Desk's API from the MSW handlers, in the browser of the mock mode. */
export async function startMockWorker(): Promise<void> {
  installStableIds()
  // Imported once the ids are stable, since the handlers build their world as they load.
  const { handlers, mockScenarios } = await import("./handlers")
  const scenario = readScenario()
  const isScenario = (name: string | null): name is keyof typeof mockScenarios =>
    name !== null && name in mockScenarios
  const scenarioHandlers = isScenario(scenario) ? mockScenarios[scenario] : []
  const worker = setupWorker(...scenarioHandlers, ...handlers)
  await worker.start({
    serviceWorker: { url: `${appBasePath}mockServiceWorker.js` },
    onUnhandledRequest: "bypass",
  })
}
