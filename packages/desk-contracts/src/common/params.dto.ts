/** The path of a project, which the paths of its Desk routes start with. */
export const PROJECT_PATH = "desk/organizations/:organizationId/projects/:projectId"

/** The path of an agent, which the paths of its Desk routes start with. */
export const AGENT_PATH = `${PROJECT_PATH}/agents/:agentId`

// The params of the routes under a project and under an agent, which the chat's contracts declare.
export {
  type AgentParamsDto,
  agentParamsSchema,
  projectParamsSchema,
} from "@caseai-connect/chat-contracts"
