import { defineSchemaRoute } from "@caseai-connect/schema-route"
import { z } from "zod"
import { myOrganizationOutputSchema } from "./organizations.dto"

export const DeskOrganizationsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "desk/organizations/mine",
    response: z.array(myOrganizationOutputSchema),
  }),
}
