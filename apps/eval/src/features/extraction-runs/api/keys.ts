import type { ExtractionRunParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"
import type { RecordsSearch } from "@/lib/records-search"
import { EXTRACTION_RUNS_QUERY_KEY } from "@/lib/run-query-keys"

export const extractionRunKeys = {
  all: EXTRACTION_RUNS_QUERY_KEY,
  ofProject: (project: ProjectParamsDto) =>
    [...extractionRunKeys.all, "project", project.organizationId, project.projectId] as const,
  /** A run and its records. */
  ofRun: (run: ExtractionRunParamsDto) =>
    [...extractionRunKeys.all, "run", run.evaluationExtractionRunId] as const,
  detail: (run: ExtractionRunParamsDto) => [...extractionRunKeys.ofRun(run), "detail"] as const,
  records: (run: ExtractionRunParamsDto) => [...extractionRunKeys.ofRun(run), "records"] as const,
  /** A page of the records of a run, for one order, one search and the filters added to it. */
  recordsPage: (
    run: ExtractionRunParamsDto,
    search: RecordsSearch,
    filters: Record<string, string>,
  ) => [...extractionRunKeys.records(run), search, filters] as const,
}
