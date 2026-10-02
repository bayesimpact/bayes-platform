import type { store } from "@/common/store"

/** Read by probe.mjs through window.__harness. */
export const harnessState: {
  scenario: string
  scenarioPath: string
  calls: string[]
  missingFixtures: Set<string>
  store?: typeof store
} = {
  scenario: "",
  scenarioPath: "",
  calls: [],
  missingFixtures: new Set(),
}

declare global {
  interface Window {
    __harness: typeof harnessState
  }
}

window.__harness = harnessState
