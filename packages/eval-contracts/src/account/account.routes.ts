import { defineSchemaRoute } from "@caseai-connect/schema-route"
import { meOutputSchema } from "./account.dto"

export const EvalAccountRoutes = {
  getMe: defineSchemaRoute({
    method: "get",
    path: "eval/me",
    response: meOutputSchema,
  }),
}
