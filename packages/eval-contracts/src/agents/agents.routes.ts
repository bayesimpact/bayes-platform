import { z } from "zod"
import { PROJECT_PATH, projectParamsSchema } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { projectAgentOutputSchema } from "./agents.dto"

export const EvalAgentsRoutes = {
  /**
   * The agents of a project that have a version in production. An evaluation and a review
   * campaign run a saved version, never a draft, so the route that also lists the agents never
   * saved, with their drafts, is not the app's.
   */
  getAllOfProject: defineSchemaRoute({
    method: "get",
    path: `${PROJECT_PATH}/agents`,
    params: projectParamsSchema,
    response: z.array(projectAgentOutputSchema),
  }),
}
