import { defineSchemaRoute } from "@caseai-connect/schema-route"
import { z } from "zod"
import { myOrganizationOutputSchema } from "./organizations.dto"

export const EvalOrganizationsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "eval/organizations/mine",
    response: z.array(myOrganizationOutputSchema),
  }),
}
