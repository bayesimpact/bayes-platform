/** The path of a project, which the paths of its routes start with. */
export const PROJECT_PATH = "eval/organizations/:organizationId/projects/:projectId"

/** The path of an agent, which the paths of its routes start with. */
export const AGENT_PATH = `${PROJECT_PATH}/agents/:agentId`

// The params of the routes under a project and under an agent, which the chat's contracts declare.
export {
  type AgentParamsDto,
  agentParamsSchema,
  type ProjectParamsDto,
  projectParamsSchema,
} from "@caseai-connect/chat-contracts"
