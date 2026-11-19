import type { ConversationRunParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"

export const conversationRunKeys = {
  all: ["conversation-runs"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...conversationRunKeys.all, "project", project.organizationId, project.projectId] as const,
  /** A run and its records. */
  ofRun: (run: ConversationRunParamsDto) =>
    [...conversationRunKeys.all, "run", run.evaluationConversationRunId] as const,
  detail: (run: ConversationRunParamsDto) => [...conversationRunKeys.ofRun(run), "detail"] as const,
  records: (run: ConversationRunParamsDto) =>
    [...conversationRunKeys.ofRun(run), "records"] as const,
  projectModels: (project: ProjectParamsDto) =>
    [...conversationRunKeys.all, "models", project.projectId] as const,
}
