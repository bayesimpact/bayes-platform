import { defineSchemaRoute } from "../define-schema-route"
import { meOutputSchema } from "./account.dto"

export const DeskAccountRoutes = {
  getMe: defineSchemaRoute({
    method: "get",
    path: "desk/me",
    response: meOutputSchema,
  }),
}
