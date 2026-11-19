import type {
  AgentParamsDto,
  ConversationRunParamsDto,
  ProjectParamsDto,
} from "@caseai-connect/eval-contracts"

export const conversationRunKeys = {
  all: ["conversation-runs"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...conversationRunKeys.all, "project", project.organizationId, project.projectId] as const,
  /** A run and every page of its records. */
  ofRun: (run: ConversationRunParamsDto) =>
    [...conversationRunKeys.all, "run", run.evaluationConversationRunId] as const,
  detail: (run: ConversationRunParamsDto) => [...conversationRunKeys.ofRun(run), "detail"] as const,
  recordsPage: (run: ConversationRunParamsDto, page: number) =>
    [...conversationRunKeys.ofRun(run), "records", page] as const,
  agentVersions: (agent: AgentParamsDto) =>
    [...conversationRunKeys.all, "versions", agent.agentId] as const,
  projectModels: (project: ProjectParamsDto) =>
    [...conversationRunKeys.all, "models", project.projectId] as const,
}
