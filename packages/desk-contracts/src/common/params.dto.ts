import { z } from "zod"

/** The path of a project, which the paths of its routes start with. */
export const PROJECT_PATH = "organizations/:organizationId/projects/:projectId"

/** The path of an agent, which the paths of its routes start with. */
export const AGENT_PATH = `${PROJECT_PATH}/agents/:agentId`

/** The params of the routes under one project. */
export const projectParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
})

/** The params of the routes under one agent: every area of the Desk extends them. */
export const agentParamsSchema = projectParamsSchema.extend({ agentId: z.uuid() })

export type AgentParamsDto = z.output<typeof agentParamsSchema>
