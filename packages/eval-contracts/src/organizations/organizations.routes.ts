import { z } from "zod"
import { defineSchemaRoute } from "../define-schema-route"
import { myOrganizationOutputSchema } from "./organizations.dto"

export const EvalOrganizationsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "eval/organizations/mine",
    response: z.array(myOrganizationOutputSchema),
  }),
}
