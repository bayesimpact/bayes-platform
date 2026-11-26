import { z } from "zod"

/** The params of the routes under one project. */
export const projectParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
})

export type ProjectParamsDto = z.output<typeof projectParamsSchema>

/** The params of the routes under one agent: every area of an app extends them. */
export const agentParamsSchema = projectParamsSchema.extend({ agentId: z.uuid() })

export type AgentParamsDto = z.output<typeof agentParamsSchema>
