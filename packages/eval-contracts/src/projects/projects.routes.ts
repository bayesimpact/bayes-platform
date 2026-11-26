import { defineSchemaRoute } from "@bayes-platform/schema-route"
import { z } from "zod"
import { myProjectOutputSchema } from "./projects.dto"

export const EvalProjectsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "eval/projects/mine",
    response: z.array(myProjectOutputSchema),
  }),
}
