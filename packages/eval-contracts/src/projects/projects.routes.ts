import { defineSchemaRoute } from "@caseai-connect/schema-route"
import { z } from "zod"
import { myProjectOutputSchema } from "./projects.dto"

export const EvalProjectsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "eval/projects/mine",
    response: z.array(myProjectOutputSchema),
  }),
}
