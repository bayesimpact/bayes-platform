import type {
  CsvExtractionRecordOutputDto,
  CsvExtractionRunDetailOutputDto,
} from "@bayes-platform/desk-contracts"
import type { AgentCsvExtractionRunsService } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.service"

/** A CSV extraction run as the service gives it, with its settings. */
export type CsvExtractionRunRecord = Awaited<
  ReturnType<AgentCsvExtractionRunsService["listRuns"]>
>[number]

/** One row of a run as the service gives it. */
export type CsvExtractionRowRecord = Awaited<
  ReturnType<AgentCsvExtractionRunsService["getRunRecordsPaginated"]>
>["records"][number]

/**
 * A run as the Desk reads it. A copy of the `toAgentCsvExtractionRunDto` of
 * `AgentCsvExtractionRunsController`, limited to the fields of the contract.
 */
export function toCsvExtractionRunDto(
  run: CsvExtractionRunRecord,
): CsvExtractionRunDetailOutputDto {
  return {
    id: run.id,
    csvDocumentId: run.csvDocumentId,
    columnSchema: run.columnSchema,
    status: run.status,
    summary: run.summary,
    csvExportDocumentId: run.csvExportDocumentId,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

/**
 * A row of a run as the Desk reads it. A copy of the `toAgentCsvExtractionRunRecordDto` of
 * `AgentCsvExtractionRunsController`, limited to the fields of the contract: the Desk shows no
 * trace.
 */
export function toCsvExtractionRecordDto(
  record: CsvExtractionRowRecord,
): CsvExtractionRecordOutputDto {
  return {
    id: record.id,
    rowIndex: record.rowIndex,
    status: record.status,
    inputData: record.inputData,
    agentRawOutput: record.agentRawOutput,
    errorDetails: record.errorDetails,
  }
}
