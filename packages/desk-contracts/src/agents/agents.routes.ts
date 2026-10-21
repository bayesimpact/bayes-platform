import { z } from "zod"
import { defineSchemaRoute } from "../define-schema-route"
import { projectAgentOutputSchema } from "./agents.dto"

export const DeskAgentsRoutes = {
  getAllOfProject: defineSchemaRoute({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents",
    params: z.strictObject({ organizationId: z.uuid(), projectId: z.uuid() }),
    response: z.array(projectAgentOutputSchema),
  }),
}
