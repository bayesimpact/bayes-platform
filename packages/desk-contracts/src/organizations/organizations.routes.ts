import { z } from "zod"
import { defineSchemaRoute } from "../define-schema-route"
import { myOrganizationOutputSchema } from "./organizations.dto"

export const DeskOrganizationsRoutes = {
  getAllMine: defineSchemaRoute({
    method: "get",
    path: "organizations/mine",
    response: z.array(myOrganizationOutputSchema),
  }),
}
