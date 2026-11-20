import type { ExtractionRunParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"

export const extractionRunKeys = {
  all: ["extraction-runs"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...extractionRunKeys.all, "project", project.organizationId, project.projectId] as const,
  /** A run and its records. */
  ofRun: (run: ExtractionRunParamsDto) =>
    [...extractionRunKeys.all, "run", run.evaluationExtractionRunId] as const,
  detail: (run: ExtractionRunParamsDto) => [...extractionRunKeys.ofRun(run), "detail"] as const,
  records: (run: ExtractionRunParamsDto) => [...extractionRunKeys.ofRun(run), "records"] as const,
}
