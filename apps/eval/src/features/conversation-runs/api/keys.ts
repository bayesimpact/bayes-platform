import type { ConversationRunParamsDto, ProjectParamsDto } from "@bayes-platform/eval-contracts"
import { CONVERSATION_RUNS_QUERY_KEY } from "@/lib/run-query-keys"

export const conversationRunKeys = {
  all: CONVERSATION_RUNS_QUERY_KEY,
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
