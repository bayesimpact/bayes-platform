import { defineSchemaRoute } from "../define-schema-route"
import {
  acceptTermsInputSchema,
  acceptTermsOutputSchema,
  meOutputSchema,
  updateMeInputSchema,
  updateMeOutputSchema,
} from "./account.dto"

export const DeskAccountRoutes = {
  getMe: defineSchemaRoute({
    method: "get",
    path: "me",
    response: meOutputSchema,
  }),
  patchMe: defineSchemaRoute({
    method: "patch",
    path: "me",
    body: updateMeInputSchema,
    response: updateMeOutputSchema,
  }),
  acceptTerms: defineSchemaRoute({
    method: "post",
    path: "me/terms-acceptances",
    body: acceptTermsInputSchema,
    response: acceptTermsOutputSchema,
  }),
}
