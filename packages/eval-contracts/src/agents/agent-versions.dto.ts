import { z } from "zod"

/** The models of a project, as `GET .../agent-models` returns them, and the one a run is judged by. */
export const agentModelsOutputSchema = z.object({
  models: z.array(
    z.object({
      model: z.string(),
      isAvailable: z.boolean(),
      /** When its provider retires the model, for a model on its way out. */
      deprecation: z.object({ deprecatedOn: z.string() }).nullable(),
      servedOutsideEu: z.boolean(),
    }),
  ),
  defaults: z.object({ judge: z.string() }),
})

export type AgentModelsOutputDto = z.output<typeof agentModelsOutputSchema>
