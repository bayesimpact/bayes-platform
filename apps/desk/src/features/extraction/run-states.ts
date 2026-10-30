import type {
  CsvExtractionRecordOutputDto,
  CsvExtractionRunStatusDto,
  ExtractionRunStatusDto,
} from "@caseai-connect/desk-contracts"
import type { RunState } from "@/lib/run-state"

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

/** Where a row of a CSV run stands, for each status the API sends. */
export const CSV_RECORD_STATES = {
  running: "running",
  success: "done",
  error: "failed",
  cancelled: "stopped",
} as const satisfies Record<CsvExtractionRecordOutputDto["status"], RunState>
