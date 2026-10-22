import { z } from "zod"
import { PROJECT_PATH, projectParamsSchema } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { projectAgentOutputSchema } from "./agents.dto"

export const DeskAgentsRoutes = {
  getAllOfProject: defineSchemaRoute({
    method: "get",
    path: `${PROJECT_PATH}/agents`,
    params: projectParamsSchema,
    response: z.array(projectAgentOutputSchema),
  }),
}
