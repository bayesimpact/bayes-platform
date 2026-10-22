import type { CsvRecordsPage } from "../schemas"

export const extractionKeys = {
  all: ["extraction"] as const,
  agent: (agentId: string) => [...extractionKeys.all, agentId] as const,
  run: (agentId: string, runId: string) =>
    [...extractionKeys.agent(agentId), "runs", runId] as const,
  csvColumns: (agentId: string, documentId: string) =>
    [...extractionKeys.agent(agentId), "csv-files", documentId, "columns"] as const,
  csvRun: (agentId: string, csvRunId: string) =>
    [...extractionKeys.agent(agentId), "csv-runs", csvRunId] as const,
  csvRecords: (agentId: string, csvRunId: string, page: CsvRecordsPage) =>
    [...extractionKeys.csvRun(agentId, csvRunId), "records", page] as const,
}
