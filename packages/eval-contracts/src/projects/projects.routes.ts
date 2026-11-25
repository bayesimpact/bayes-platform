import { z } from "zod"
import { defineSchemaRoute } from "../define-schema-route"
import { myProjectOutputSchema } from "./projects.dto"

export const EvalProjectsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "eval/projects/mine",
    response: z.array(myProjectOutputSchema),
  }),
}
