import { defineSchemaRoute } from "@bayes-platform/schema-route"
import { z } from "zod"
import { myProjectOutputSchema } from "./projects.dto"

export const DeskProjectsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "desk/projects/mine",
    response: z.array(myProjectOutputSchema),
  }),
}
