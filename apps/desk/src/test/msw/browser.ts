import { setupWorker } from "msw/browser"
import { appBasePath } from "@/app/config"
import { handlers, mockScenarios } from "./handlers"

function isScenario(name: string | null): name is keyof typeof mockScenarios {
  return name !== null && name in mockScenarios
}

/** Serves the Desk's API from the MSW handlers, in the browser of the mock mode. */
export async function startMockWorker(): Promise<void> {
  const scenario = new URLSearchParams(window.location.search).get("mock")
  const worker = setupWorker(...(isScenario(scenario) ? mockScenarios[scenario] : []), ...handlers)
  await worker.start({
    serviceWorker: { url: `${appBasePath}mockServiceWorker.js` },
    onUnhandledRequest: "bypass",
  })
}
