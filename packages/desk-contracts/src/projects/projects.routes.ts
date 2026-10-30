import { z } from "zod"
import { defineSchemaRoute } from "../define-schema-route"
import { myProjectOutputSchema } from "./projects.dto"

export const DeskProjectsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "projects/mine",
    response: z.array(myProjectOutputSchema),
  }),
}
