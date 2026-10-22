import type {
  CsvExtractionRunStatusDto,
  ExtractionRunStatusDto,
} from "@caseai-connect/desk-contracts"

/** Where a run stands, as both kinds of run show it. */
export type RunState = "starting" | "running" | "done" | "failed" | "stopped"

/** Where the extraction of a document stands, for each status the API sends. */
export const EXTRACTION_RUN_STATES = {
  pending: "running",
  success: "done",
  failed: "failed",
} as const satisfies Record<ExtractionRunStatusDto, RunState>

/** Where the extraction of a CSV file stands, for each status the API sends. */
export const CSV_RUN_STATES = {
  pending: "starting",
  running: "running",
  completed: "done",
  failed: "failed",
  cancelled: "stopped",
} as const satisfies Record<CsvExtractionRunStatusDto, RunState>
