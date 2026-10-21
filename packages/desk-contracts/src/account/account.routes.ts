import { defineSchemaRoute } from "../define-schema-route"
import { acceptTermsInputSchema, acceptTermsOutputSchema, meOutputSchema } from "./account.dto"

export const DeskAccountRoutes = {
  getMe: defineSchemaRoute({
    method: "get",
    path: "me",
    response: meOutputSchema,
  }),
  acceptTerms: defineSchemaRoute({
    method: "post",
    path: "me/terms-acceptances",
    body: acceptTermsInputSchema,
    response: acceptTermsOutputSchema,
  }),
}
