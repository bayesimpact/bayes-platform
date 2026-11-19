import type { ConversationDatasetParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"

export const conversationDatasetKeys = {
  all: ["conversation-datasets"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...conversationDatasetKeys.all, "project", project.organizationId, project.projectId] as const,
  /** Every page of a dataset's records. */
  records: (dataset: ConversationDatasetParamsDto) =>
    [...conversationDatasetKeys.all, "records", dataset.datasetId] as const,
  recordsPage: (dataset: ConversationDatasetParamsDto, page: number) =>
    [...conversationDatasetKeys.records(dataset), page] as const,
}
