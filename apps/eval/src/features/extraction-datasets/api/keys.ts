import type { ExtractionDatasetParamsDto, ProjectParamsDto } from "@bayes-platform/eval-contracts"
import type { RecordsSearch } from "@/lib/records-search"

export const extractionDatasetKeys = {
  all: ["extraction-datasets"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...extractionDatasetKeys.all, "project", project.organizationId, project.projectId] as const,
  /** Every page of the records of a dataset. */
  records: (dataset: ExtractionDatasetParamsDto) =>
    [...extractionDatasetKeys.all, "records", dataset.datasetId] as const,
  /** A page of the records of a dataset, for one order and one search. */
  recordsPage: (dataset: ExtractionDatasetParamsDto, search: RecordsSearch) =>
    [...extractionDatasetKeys.records(dataset), search] as const,
  /** The CSV files of a project. */
  files: (project: ProjectParamsDto) =>
    [...extractionDatasetKeys.all, "files", project.organizationId, project.projectId] as const,
  /** The columns of a file. */
  fileColumns: (project: ProjectParamsDto, documentId: string) =>
    [...extractionDatasetKeys.files(project), documentId, "columns"] as const,
}
