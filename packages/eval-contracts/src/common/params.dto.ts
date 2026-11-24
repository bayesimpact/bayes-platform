import { z } from "zod"

/** The path of a project, which the paths of its routes start with. */
export const PROJECT_PATH = "eval/organizations/:organizationId/projects/:projectId"

/** The path of an agent, which the paths of its routes start with. */
export const AGENT_PATH = `${PROJECT_PATH}/agents/:agentId`

/**
 * The path of a project before the API served the Evaluation routes under `eval/`. The areas not
 * yet served by the Evaluation module keep it until they move.
 */
export const LEGACY_PROJECT_PATH = "organizations/:organizationId/projects/:projectId"

/** The path of an agent before the API served the Evaluation routes under `eval/`. */
export const LEGACY_AGENT_PATH = `${LEGACY_PROJECT_PATH}/agents/:agentId`

/** The params of the routes under one project. */
export const projectParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
})

export type ProjectParamsDto = z.output<typeof projectParamsSchema>

/** The params of the pages of one agent. */
export const agentParamsSchema = projectParamsSchema.extend({ agentId: z.uuid() })

export type AgentParamsDto = z.output<typeof agentParamsSchema>
