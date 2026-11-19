import { z } from "zod"

/**
 * A version of an agent's settings, as `GET .../agents/:agentId/settings` returns it: the app
 * reads what tells the versions apart, to pick the one a run evaluates.
 */
export const agentVersionOutputSchema = z.object({
  revision: z.number(),
  /** The version in edit, which a run never evaluates. */
  isDraft: z.boolean(),
  isArchived: z.boolean(),
  /** The saved version every live channel runs with. */
  isProduction: z.boolean(),
  model: z.string(),
  createdAt: z.number(),
})

export type AgentVersionOutputDto = z.output<typeof agentVersionOutputSchema>

/** The models of a project, as `GET .../agent-models` returns them, and the one a run is judged by. */
export const agentModelsOutputSchema = z.object({
  models: z.array(z.object({ model: z.string(), isAvailable: z.boolean() })),
  defaults: z.object({ judge: z.string() }),
})

export type AgentModelsOutputDto = z.output<typeof agentModelsOutputSchema>
