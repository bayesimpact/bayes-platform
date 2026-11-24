import { z } from "zod"

/** The models of a project, as `GET eval/.../agent-models` returns them, and the one a run is judged by. */
export const agentModelsOutputSchema = z.object({
  models: z.array(
    z.object({
      model: z.string(),
      isAvailable: z.boolean(),
      /** Present for a model its provider retires: the app reads only whether it is there. */
      deprecation: z.object({}).nullable(),
      servedOutsideEu: z.boolean(),
    }),
  ),
  defaults: z.object({ judge: z.string() }),
})

export type AgentModelsOutputDto = z.output<typeof agentModelsOutputSchema>
