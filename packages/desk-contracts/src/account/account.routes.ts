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
    path: "desk/me",
    response: meOutputSchema,
  }),
  patchMe: defineSchemaRoute({
    method: "patch",
    path: "desk/me",
    body: updateMeInputSchema,
    response: updateMeOutputSchema,
  }),
  acceptTerms: defineSchemaRoute({
    method: "post",
    path: "desk/me/terms-acceptances",
    body: acceptTermsInputSchema,
    response: acceptTermsOutputSchema,
  }),
}
