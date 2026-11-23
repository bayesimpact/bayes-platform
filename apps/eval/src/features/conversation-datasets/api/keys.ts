import type { ConversationDatasetParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"

export const conversationDatasetKeys = {
  all: ["conversation-datasets"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...conversationDatasetKeys.all, "project", project.organizationId, project.projectId] as const,
  /** All the records of a dataset. */
  records: (dataset: ConversationDatasetParamsDto) =>
    [...conversationDatasetKeys.all, "records", dataset.datasetId] as const,
}
