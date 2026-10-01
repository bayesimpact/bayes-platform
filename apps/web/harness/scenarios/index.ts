import { evalExtractionDataset } from "./eval-extraction-dataset"
import type { Scenario } from "./types"

// Add a scenario here to make it available as ?scenario=<key>.
export const scenarios: Record<string, Scenario> = {
  "eval-extraction-dataset": evalExtractionDataset,
}

export const DEFAULT_SCENARIO = "eval-extraction-dataset"
