import type { ExtractionDatasetParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"

export const extractionDatasetKeys = {
  all: ["extraction-datasets"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...extractionDatasetKeys.all, "project", project.organizationId, project.projectId] as const,
  /** All the records of a dataset. */
  records: (dataset: ExtractionDatasetParamsDto) =>
    [...extractionDatasetKeys.all, "records", dataset.datasetId] as const,
  /** The CSV files of a project. */
  files: (project: ProjectParamsDto) =>
    [...extractionDatasetKeys.all, "files", project.organizationId, project.projectId] as const,
  /** The columns of a file. */
  fileColumns: (project: ProjectParamsDto, documentId: string) =>
    [...extractionDatasetKeys.files(project), documentId, "columns"] as const,
}
