import { defineSchemaRoute } from "../define-schema-route"
import { meOutputSchema } from "./account.dto"

export const EvalAccountRoutes = {
  getMe: defineSchemaRoute({
    method: "get",
    path: "me",
    response: meOutputSchema,
  }),
}
