import { defineSchemaRoute } from "../define-schema-route"
import {
  invitationAnswerOutputSchema,
  invitationParamsSchema,
  myInvitationsOutputSchema,
} from "./invitations.dto"

/** The signed-in person's own invitations, which they accept or decline. */
export const DeskInvitationsRoutes = {
  getMine: defineSchemaRoute({
    method: "get",
    path: "me/invitations",
    response: myInvitationsOutputSchema,
  }),
  acceptOne: defineSchemaRoute({
    method: "post",
    path: "me/invitations/:invitationId/accept",
    params: invitationParamsSchema,
    response: invitationAnswerOutputSchema,
  }),
  declineOne: defineSchemaRoute({
    method: "post",
    path: "me/invitations/:invitationId/decline",
    params: invitationParamsSchema,
    response: invitationAnswerOutputSchema,
  }),
}
